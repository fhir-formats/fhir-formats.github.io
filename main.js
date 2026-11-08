function FhirInputView(el) {
  this.el = el;
  /* per-instance flag: while set, edits in this view don't trigger a conversion */
  var updatesPaused = false;
  var codemirror = this.codemirror = CodeMirror.fromTextArea(this.el, {
    mode: {
      name: "javascript",
      json: true,
    },
    lineNumbers: true,
    lineWrapping: true
  });

  codemirror.on("change", function() {
    updateMode();
  });

  var self = this;
  function otherView() {
    return self === leftFhirView ? rightFhirView : leftFhirView;
  }

  /* status line under the editor: why this view's input doesn't convert, or
     a note that this view's output is out of date */
  var status = document.createElement("div");
  status.className = "fhir-status";
  status.innerHTML = '<i class="material-icons fhir-status__icon" aria-hidden="true"></i>' +
    '<span class="fhir-status__text" role="status" aria-live="polite"></span>' +
    '<details class="fhir-status__details" hidden><summary>Details</summary><pre></pre></details>';
  el.parentNode.appendChild(status);
  var statusText = status.querySelector(".fhir-status__text");
  var statusDetails = status.querySelector("details");
  var statusKind = null, statusKey = "", errorLine = null, errorTimer = null;

  /* kind is "error", "stale" or null (hidden); problem is {line, template, args, details} */
  function setStatus(kind, problem) {
    problem = problem || {};
    var key = kind + JSON.stringify(problem);
    if (key === statusKey) { return; }
    statusKey = key;
    statusKind = kind;
    status.className = "fhir-status" + (kind ? " is-" + kind : "");
    el.parentNode.classList.toggle("fhir-input--stale", kind === "stale");
    status.firstChild.textContent = { error: "error_outline", stale: "history" }[kind] || "";
    renderMessage(statusText, problem);
    statusDetails.hidden = !problem.details;
    statusDetails.lastChild.textContent = problem.details || "";
  }

  function setErrorLine(line) {
    if (errorLine) { codemirror.removeLineClass(errorLine, "background", "fhir-error-line"); }
    errorLine = line ? codemirror.addLineClass(Math.min(line, codemirror.lineCount()) - 1, "background", "fhir-error-line") : null;
  }

  /* hides this view's error or stale note, including one still waiting to be shown */
  function clearStatus() {
    clearTimeout(errorTimer);
    errorTimer = null;
    setStatus(null);
    setErrorLine(null);
  }
  this.clearStatus = clearStatus;

  /* marks this view's content as the output of an earlier, valid input
     (unless it's input with an error of its own, shown or about to be) */
  function showStale() {
    if (statusKind !== "error" && !errorTimer && codemirror.getValue() !== "") {
      setStatus("stale", { template: "Output is from your last valid input." });
    }
  }
  this.showStale = showStale;

  /* explains why this view's content didn't convert and marks the other view as stale */
  function showError(luaError) {
    var text = codemirror.getValue();
    var problem;
    errorTimer = null;
    try {
      problem = codemirror.getOption("mode") === "xml" ?
        describeXmlError(text, luaError) :
        describeJsonError(text, luaError, getFhirVersion());
    } catch (e) {
      problem = { template: GENERIC_LUA_PROBLEM, details: cleanLuaError(luaError) };
    }
    setStatus("error", problem);
    setErrorLine(problem.line);
    otherView().showStale();
  }

  /* JSON starts with { or [ */
  function looksLikeJson(code) {
    return /^\s*[\{\[]/.test(code);
  }

  function pauseUpdates() {
    updatesPaused = true;
  }
  this.pauseUpdates = pauseUpdates;

  function unpauseUpdates() {
    updatesPaused = false;
  }
  this.unpauseUpdates = unpauseUpdates;

  function setRenderingMode(mode) {
    codemirror.setOption("mode", mode);
  }
  this.setRenderingMode = setRenderingMode

  var oldValue = '';
  /* updates mode of the codemirror and sends data for conversion */
  function updateMode() {
    if (updatesPaused) { return; }

    /* don't do anything if the data content is the same */
    var text = codemirror.getValue();
    if (text === oldValue) {
      return;
    }
    oldValue = text;
    if (statusKind === "stale") { setStatus(null); }

    if (text === "") {
      clearOtherView();
      clearStatus();
      otherView().clearStatus();
      return;
    }

    /* update code mirror's highlighting mode */
    codemirror.setOption("mode", looksLikeJson(text) ? "javascript" : "xml");
    /* convert data to other format and send to opposite codemirror */
    convertData();
  }

  /* updates data of codemirror as well as the cache, while keeping scroll position.
     Doesn't convert the new text back into the other view. */
  function setText(text, checkMode) {
    var scrollInfo = codemirror.getScrollInfo();
    var wasPaused = updatesPaused;
    updatesPaused = true;
    try {
      codemirror.setValue(text);
    } finally {
      updatesPaused = wasPaused;
    }
    codemirror.scrollTo(scrollInfo.left, scrollInfo.top);
    oldValue = codemirror.getValue();

    if (checkMode) {
      codemirror.setOption("mode", looksLikeJson(text) ? "javascript" : "xml");
    }
  }
  this.setText = setText;

  /* converts this view's content and puts the result into the other view.
     Returns the {ok, value|error} result of the conversion; on failure the
     other view is left unchanged and the error is shown after the user
     pauses typing (or straight away if showErrorNow is set). */
  function convertData(showErrorNow) {
    var mode = codemirror.getOption("mode");
    var convertFunction = mode == "xml" ? "in_fhir_json" : "in_fhir_xml";
    sourceView = self;

    var result = runLuaSafe(convertFunction, codemirror.getValue(), getFhirVersion());
    clearTimeout(errorTimer);
    if (!result.ok) {
      console.warn("FHIR conversion failed: " + result.error);
      if (showErrorNow) {
        showError(result.error);
      } else {
        errorTimer = setTimeout(function() { showError(result.error); }, ERROR_DELAY_MS);
      }
      return result;
    }

    otherView().setText(result.value, true);
    clearStatus();
    otherView().clearStatus();
    return result;
  }
  this.convertData = convertData;

  function clearOtherView() {
    otherView().setText("");
  }

  /* shows a message (e.g. an XML comment) without converting it to the other view */
  function showMessage(text) {
    clearStatus();
    if (sourceView === self) { sourceView = null; }
    setText(text, true);
  }
  this.showMessage = showMessage;
}

/* Runs one of the global Lua conversion functions (in_fhir_json or in_fhir_xml)
   on the given text. The text and FHIR version are handed to Lua as arguments
   rather than spliced into Lua source, so any input (including "]]") is safe.
   Never throws; returns {ok: true, value: <string>} or {ok: false, error: <string>}. */
function runLuaSafe(convertFunction, text, fhirVersion) {
  var results;
  try {
    results = L.execute(
      "local convert, text, fhirversion = ...\n" +
      "return _G[convert](text, {pretty = true, fhirversion = fhirversion})",
      convertFunction, text, fhirVersion || "auto");
  } catch (e) {
    return { ok: false, error: String(e) };
  }

  var value = results[0];
  if (typeof value !== "string") {
    return { ok: false, error: convertFunction + " returned no output" };
  }
  return { ok: true, value: value };
}

/* errors are shown once the user pauses typing for this long */
var ERROR_DELAY_MS = 700;

function getFhirVersion() {
  return document.getElementById("fhir-version-select").value;
}

/* Fills el with a problem's message: "Line N: " (if known) followed by its
   template, where `text in backticks` becomes code and $1, $2... are replaced
   by problem.args. Args are inserted as plain text after the split, so
   backticks in the user's own text can't break the formatting. */
function renderMessage(el, problem) {
  var template = problem.template || "";
  if (problem.line) {
    template = "Line " + problem.line + ": " + template;
  } else {
    template = template.charAt(0).toUpperCase() + template.slice(1);
  }
  el.textContent = "";
  template.split("`").forEach(function(part, i) {
    part = part.replace(/\$(\d)/g, function(m, n) { return (problem.args || [])[n - 1]; });
    var node = i % 2 ? document.createElement("code") : document.createTextNode(part);
    node.textContent = part;
    el.appendChild(node);
  });
}

/* 1-based line number of a 0-based character offset */
function lineAt(text, offset) {
  return text.slice(0, offset).split("\n").length;
}

/* the end of a line of code, short enough to quote in a message */
function excerpt(code) {
  code = code.trim();
  return code.length > 40 ? "…" + code.slice(-39) : code;
}

/* removes the Lua chunk name ([string "https://..."]:1695:) and any stack traceback */
function cleanLuaError(error) {
  return String(error)
    .replace(/^Lua\.Error:\s*/, "")
    .replace(/\[string "[^"]*"\]:\d+:\s*/g, "")
    .replace(/\s*stack traceback:[\s\S]*$/, "");
}

var GENERIC_LUA_PROBLEM = "couldn't convert this resource. The converter's own message is under Details.";

/* browser XML parser messages (current Chromium, libxml2 in Safari and older
   Chromium, Firefox) and what they mean */
var XML_PARSER_MESSAGES = [
  [/Unexpected closing tag: (?:\{[^}]*\})?(\S+) != (?:\{[^}]*\})?(\S+)/, "`<$2>` needs a closing `</$2>` before `</$1>`."],
  [/Opening and ending tag mismatch: (\S+) line \d+ and (\S+)/, "`<$1>` needs a closing `</$1>` before `</$2>`."],
  [/mismatched tag\. Expected: <\/([^>\s]+)>/, "expected the closing tag `</$1>` here."],
  [/still inside the root element|Premature end of data/, "the XML ends while some elements are still open."],
  [/no root element found|no element found/, "no XML element found."],
  [/Unexpected end of stream$/, "the XML ends unexpectedly."],
  [/Attribute '?([^'\s]+)'? (?:is )?redefined/, "the `$1` attribute appears twice in the same element."],
  [/duplicate attribute/, "the same attribute appears twice in one element."],
  [/'<' (?:is )?not allowed in attributes/, "`<` isn't allowed in an attribute value; write it as `&lt;`."],
  [/Unexpected token inside entity|xmlParseEntityRef: no name|EntityRef: expecting ';'/, "an `&` that doesn't start an entity must be written as `&amp;`."],
  [/Unexpected entity: (\S+)|Entity '([^']+)' not defined/, "`&$1$2;` isn't defined in XML. Use `&amp;`, `&lt;`, `&gt;`, `&quot;`, `&apos;` or a number like `&#160;`."],
  [/Invalid processing instruction: <\?xml|XML declaration allowed only at the start/, "`<?xml ...?>` must come first, before any spaces, comments or elements."],
  [/Unexpected token '--'|Double hyphen within comment/, "`--` isn't allowed inside an XML comment."],
  [/outside the root element|junk after document element|Extra content at the end of the document/, "there's content outside the root element."]
];

/* works out a plain-language {line, template, args, details} for XML that didn't convert */
function describeXmlError(text, luaError) {
  if (!/^\s*</.test(text)) {
    return { template: "this doesn't look like XML or JSON: XML starts with `<`, JSON with `{`.", details: cleanLuaError(luaError) };
  }

  var doc = new DOMParser().parseFromString(text, "application/xml");
  var parserError = [].filter.call(doc.getElementsByTagName("parsererror"), function(e) {
    return e.namespaceURI !== "http://hl7.org/fhir";
  })[0];
  if (parserError) {
    var raw = parserError.textContent;
    var reason = /line \d+ at column \d+: ([\s\S]*?)(?:Below is a rendering of the page up to the first error\.?)?$/.exec(raw) ||
                 /XML Parsing Error: ([^\n]*)/.exec(raw);
    reason = reason ? reason[1].trim() : raw;
    var line = /line(?: number)? (\d+)/i.exec(raw);
    var problem = { line: line && +line[1], template: "the XML isn't well-formed here.", args: [], details: reason };
    XML_PARSER_MESSAGES.some(function(entry) {
      var m = entry[0].exec(reason);
      if (m) {
        problem.template = entry[1];
        problem.args = m.slice(1).map(function(arg) { return arg || ""; });
      }
      return m;
    });
    if (!problem.line) { problem.template = problem.template.replace(" here.", "."); }

    /* for a missing closing tag, point at the opening tag if our own scan agrees with the browser */
    var unclosed = findUnclosedTag(text);
    var open = unclosed.open && unclosed.open[2], close = unclosed.close && unclosed.close[2];
    var chromium = /closing tag: (?:\{[^}]*\})?(\S+) != (?:\{[^}]*\})?(\S+)/.exec(reason); // found, expected
    var libxml2 = /tag mismatch: (\S+) line \d+ and (\S+)/.exec(reason); // expected, found
    var firefox = /Expected: <\/([^>\s]+)>/.exec(reason); // expected
    var agrees = chromium ? chromium[2] === open && chromium[1] === close :
                 libxml2 ? libxml2[1] === open && libxml2[2] === close :
                 firefox && firefox[1] === open;
    if (open && (close ? agrees : /still inside the root element|Premature end of data|no element found/.test(reason))) {
      problem.line = lineAt(text, unclosed.open.index);
      problem.template = "`<$1>` is opened but never closed" +
        (close ? " (line $2 has `</$3>` where `</$1>` was expected)." : ".");
      problem.args = [open, close && lineAt(text, unclosed.close.index), close];
    }
    return problem;
  }

  /* well-formed, so the converter itself objected */
  var details = cleanLuaError(luaError);
  var textValue = /unexpected type value encountered: ([\s\S]*) \(string\), expecting table/.exec(details);
  var parent = textValue && findTextParent(doc, textValue[1]);
  if (parent) {
    var found = new RegExp(">\\s*" + textValue[1].trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).exec(text);
    var lineNo = found ? lineAt(text, found.index + found[0].length - 1) : null;
    if (parent.localName === "div" && parent.namespaceURI !== "http://www.w3.org/1999/xhtml") {
      return { line: lineNo, template: "the narrative `<div>` needs `xmlns=\"http://www.w3.org/1999/xhtml\"`.", details: details };
    }
    var name = parent.localName;
    var example = parent.firstElementChild || parent === doc.documentElement ?
      "<given value=\"Peter\"/>" : "<" + name + " value=\"" + excerpt(textValue[1]) + "\"/>";
    return {
      line: lineNo,
      template: "`<$1>` has text between its tags (`$2`). FHIR XML puts values in a `value` attribute instead, like `$3`.",
      args: [name, excerpt(textValue[1]), example],
      details: details
    };
  }
  return { template: GENERIC_LUA_PROBLEM, details: details };
}

/* Scans the tags in well-formed-so-far XML for the innermost element left open:
   returns {open, close} at the first closing tag that doesn't match, else {open}
   for whatever is still open at the end. Both are regex matches; [2] is the name. */
function findUnclosedTag(text) {
  var tag = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<[?!][^>]*>|<(\/?)([^\s\/>]+)(?:"[^"]*"|'[^']*'|[^'">])*?(\/?)>/g;
  var openTags = [], m;
  while ((m = tag.exec(text))) {
    if (!m[2] || m[3]) { continue; } // comment, CDATA, declaration or self-closing tag
    if (!m[1]) {
      openTags.push(m);
      continue;
    }
    var top = openTags[openTags.length - 1];
    if (!top || top[2] !== m[2]) { return { open: top, close: m }; }
    openTags.pop();
  }
  return { open: openTags[openTags.length - 1] };
}

/* the element directly containing a text (or CDATA) node with the given text */
function findTextParent(doc, value) {
  var walker = doc.createTreeWalker(doc, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_CDATA_SECTION);
  while (walker.nextNode()) {
    if (walker.currentNode.nodeValue.trim() === value.trim()) { return walker.currentNode.parentNode; }
  }
  return null;
}

/* V8 leaves the position out of "Unexpected token" messages, but quotes up to
   10 characters either side of it; find it from that quote */
function jsonTokenPosition(text, message) {
  var m = /^Unexpected token '([\s\S]+?)', (\.\.\.)?"([\s\S]*)"(\.\.\.)? is not valid JSON/.exec(message);
  if (!m) { return null; }
  if (m[2]) {
    var start = m[4] ? text.indexOf(m[3]) : text.length - m[3].length;
    return start < 0 ? null : start + 10;
  }
  if (m[4]) { return m[3].length - 10; }
  return text.indexOf(m[1]) === text.lastIndexOf(m[1]) ? text.indexOf(m[1]) : null;
}

/* works out a plain-language {line, template, args, details} for JSON that didn't convert */
function describeJsonError(text, luaError, fhirVersion) {
  var data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return describeJsonSyntaxError(text, e.message);
  }

  /* well-formed, so check the basics the converter relies on */
  var details = cleanLuaError(luaError);
  var resourceTypeAt = /"resourceType"\s*:/.exec(text);
  var resourceTypeLine = resourceTypeAt ? lineAt(text, resourceTypeAt.index) : null;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { template: "a FHIR resource in JSON must be a single object, like `{\"resourceType\": \"Patient\", ...}`.", details: details };
  }
  if (!("resourceType" in data)) {
    return { template: "there's no `\"resourceType\"`. Every FHIR resource needs one, like `\"resourceType\": \"Patient\"`.", details: details };
  }
  if (typeof data.resourceType !== "string") {
    return { line: resourceTypeLine, template: "`\"resourceType\"` must be text, like `\"resourceType\": \"Patient\"`.", details: details };
  }
  /* does the converter know this resource type at all? (checked against one it surely knows) */
  if (runLuaSafe("in_fhir_xml", '{"resourceType": "Patient", "id": "x"}', fhirVersion).ok &&
      !runLuaSafe("in_fhir_xml", JSON.stringify({ resourceType: data.resourceType, id: "x" }), fhirVersion).ok) {
    return {
      line: resourceTypeLine,
      template: "the converter doesn't recognise `\"resourceType\": $1` (FHIR version: $2). Check the spelling and capitalisation, or choose another FHIR version from the ☰ menu.",
      args: [JSON.stringify(data.resourceType), fhirVersion === "auto" ? "Auto" : fhirVersion],
      details: details
    };
  }
  var badDiv = findBadDiv(data);
  if (badDiv) {
    var divs = text.match(/"div"\s*:/g);
    var divAt = divs && divs.length === 1 ? lineAt(text, text.search(/"div"\s*:/)) : null;
    return { line: divAt, template: "the narrative `\"div\"` isn't well-formed XHTML.", details: badDiv + "\n" + details };
  }
  return { template: GENERIC_LUA_PROBLEM, details: details };
}

/* the browser's parse error for the first narrative "div" that isn't well-formed XML, if any */
function findBadDiv(data) {
  for (var key in data) {
    var value = data[key];
    if (key === "div" && typeof value === "string") {
      var error = new DOMParser().parseFromString(value, "application/xml").getElementsByTagName("parsererror")[0];
      if (error) { return error.textContent.replace(/^This page contains the following errors:|Below is a rendering[\s\S]*$/g, ""); }
    } else if (value && typeof value === "object") {
      var found = findBadDiv(value);
      if (found) { return found; }
    }
  }
  return null;
}

function describeJsonSyntaxError(text, message) {
  var position = /position (\d+)/.exec(message);
  var lineColumn = /line (\d+) column (\d+)/.exec(message);
  position = position ? +position[1] :
    /Unexpected end of (JSON input|data)|end of data/i.test(message) ? text.length :
    lineColumn ? text.split("\n").slice(0, lineColumn[1] - 1).join("\n").length + (lineColumn[1] > 1) + (lineColumn[2] - 1) :
    jsonTokenPosition(text, message);
  var problem = { template: "this isn't valid JSON.", args: [], details: message };
  if (position == null) { return problem; }

  var end = text.replace(/\s+$/, "").length;
  var at = text.charAt(position);
  /* the last non-space character before the problem */
  var before = text.slice(0, position).replace(/\s+$/, "");
  var prev = before.charAt(before.length - 1);
  var prevLine = lineAt(text, before.length - 1);
  var lineBefore = before.slice(before.lastIndexOf("\n") + 1);
  var word = (/[A-Za-z_$][\w$]*$/.exec(text.slice(0, position)) || [""])[0] + (/^[\w$]*/.exec(text.slice(position)) || [""])[0];
  var key = /("(?:[^"\\]|\\.)*")\s*:?\s*$/.exec(before);

  problem.line = lineAt(text, position);
  function say(template, args, line) {
    problem.template = template;
    problem.args = args || [];
    if (line) { problem.line = line; }
    return problem;
  }

  if (/Unterminated string/i.test(message)) {
    return say("this text isn't closed with a `\"`.");
  }
  if (position >= end) {
    return say("the JSON ends before every `{` and `[` is closed.", [], lineAt(text, end - 1));
  }
  if (/Bad control character/i.test(message)) {
    return at === "\n" || at === "\r" ?
      say("this text isn't closed with a `\"` before the line ends.") :
      say("text can't contain tabs or other control characters; write a tab as `\\t`.");
  }
  if (/Expected ',' or '([}\]])'/i.test(message)) {
    return /["{\[\w-]/.test(at) ?
      say("missing comma after `$1`.", [excerpt(lineBefore)], prevLine) :
      say("expected `,` or `$1` here.", [/Expected ',' or '([}\]])'/i.exec(message)[1]]);
  }
  if (/Expected ':' after property name/i.test(message) && key) {
    return say("missing `:` after `$1`.", [excerpt(key[1])]);
  }
  if (/Unexpected non-whitespace character after JSON/i.test(message)) {
    return at === "}" || at === "]" ?
      say("extra `$1` after the end of the JSON.", [at]) :
      say("there's more text after the end of the JSON.");
  }
  if (/Bad escaped character/i.test(message)) {
    var backslash = text.lastIndexOf("\\", position);
    return say("`$1` isn't a valid escape in JSON text.", [text.substr(backslash, 2)]);
  }
  if (prev === "," && (at === "}" || at === "]")) {
    return say("remove the comma before `$1`; JSON doesn't allow a trailing comma.", [at], prevLine);
  }
  if (at === "'") {
    return say("JSON needs double quotes (`\"`), not single quotes (`'`).");
  }
  if (at === "/") {
    return say("JSON doesn't allow comments.");
  }
  if (/property name/i.test(message) && /[A-Za-z_$]/.test(at)) {
    return say("property names need double quotes, like `\"$1\"`.", [word]);
  }
  if (/Unexpected (token|character|keyword)/i.test(message)) {
    if (word && !/^(true|false|null)$/.test(word)) {
      return say("`$1` isn't valid JSON. Text needs double quotes, and the only bare words allowed are `true`, `false` and `null`.", [excerpt(word)]);
    }
    if (prev === ":" && key) {
      return say("`$1:` has no value.", [excerpt(key[1])], prevLine);
    }
  }
  problem.template = "this isn't valid JSON here.";
  return problem;
}

var leftFhirView = new FhirInputView(document.getElementById('fhir-input-left'));
var rightFhirView = new FhirInputView(document.getElementById('fhir-input-right'));
/* the view whose content was last converted into the other one (null while it shows a message) */
var sourceView = leftFhirView;

/* converts an example JSON resource to XML and shows it in the left view */
function loadExample(json) {
  var result = runLuaSafe("in_fhir_xml", json, "auto");
  if (result.ok) {
    leftFhirView.setText(result.value, true);
    leftFhirView.convertData(true);
  } else {
    console.warn("Failed to convert example: " + result.error);
  }
  document.querySelector('.mdl-layout').MaterialLayout.toggleDrawer();
}

document.getElementById('skeleton-patient__link').onclick = function () {
  loadExample("{\"identifier\":[{\"type\":{\"coding\":[{\"code\":\"MR\",\"system\":\"http://hl7.org/fhir/v2/0203\"}]},\"use\":\"usual\"}],\"resourceType\":\"Patient\",\"id\":\"example\"}");
}

document.getElementById('full-patient__link').onclick = function () {
  loadExample("{\"resourceType\":\"Patient\",\"id\":\"example\",\"text\":{\"status\":\"generated\",\"div\":\"<div xmlns=\\\"http:\/\/www.w3.org\/1999\/xhtml\\\">\\n\\t\\t\\t<table>\\n\\t\\t\\t\\t<tbody>\\n\\t\\t\\t\\t\\t<tr>\\n\\t\\t\\t\\t\\t\\t<td>Name<\/td>\\n\\t\\t\\t\\t\\t\\t<td>Peter James \\n              <b>Chalmers<\/b> (&quot;Jim&quot;)\\n            <\/td>\\n\\t\\t\\t\\t\\t<\/tr>\\n\\t\\t\\t\\t\\t<tr>\\n\\t\\t\\t\\t\\t\\t<td>Address<\/td>\\n\\t\\t\\t\\t\\t\\t<td>534 Erewhon, Pleasantville, Vic, 3999<\/td>\\n\\t\\t\\t\\t\\t<\/tr>\\n\\t\\t\\t\\t\\t<tr>\\n\\t\\t\\t\\t\\t\\t<td>Contacts<\/td>\\n\\t\\t\\t\\t\\t\\t<td>Home: unknown. Work: (03) 5555 6473<\/td>\\n\\t\\t\\t\\t\\t<\/tr>\\n\\t\\t\\t\\t\\t<tr>\\n\\t\\t\\t\\t\\t\\t<td>Id<\/td>\\n\\t\\t\\t\\t\\t\\t<td>MRN: 12345 (Acme Healthcare)<\/td>\\n\\t\\t\\t\\t\\t<\/tr>\\n\\t\\t\\t\\t<\/tbody>\\n\\t\\t\\t<\/table>\\n\\t\\t<\/div>\"},\"identifier\":[{\"use\":\"usual\",\"type\":{\"coding\":[{\"system\":\"http:\/\/hl7.org\/fhir\/v2\/0203\",\"code\":\"MR\"}]},\"system\":\"urn:oid:1.2.36.146.595.217.0.1\",\"value\":\"12345\",\"period\":{\"start\":\"2001-05-06\"},\"assigner\":{\"display\":\"Acme Healthcare\"}}],\"active\":true,\"name\":[{\"use\":\"official\",\"family\":\"Chalmers\",\"given\":[\"Peter\",\"James\"]},{\"use\":\"usual\",\"given\":[\"Jim\"]},{\"use\":\"maiden\",\"family\":\"Windsor\",\"given\":[\"Peter\",\"James\"],\"period\":{\"end\":\"2002\"}}],\"telecom\":[{\"use\":\"home\"},{\"system\":\"phone\",\"value\":\"(03) 5555 6473\",\"use\":\"work\",\"rank\":1},{\"system\":\"phone\",\"value\":\"(03) 3410 5613\",\"use\":\"mobile\",\"rank\":2},{\"system\":\"phone\",\"value\":\"(03) 5555 8834\",\"use\":\"old\",\"period\":{\"end\":\"2014\"}}],\"gender\":\"male\",\"birthDate\":\"1974-12-25\",\"_birthDate\":{\"extension\":[{\"url\":\"http:\/\/hl7.org\/fhir\/StructureDefinition\/patient-birthTime\",\"valueDateTime\":\"1974-12-25T14:35:45-05:00\"}]},\"deceasedBoolean\":false,\"address\":[{\"use\":\"home\",\"type\":\"both\",\"text\":\"534 Erewhon St PeasantVille, Rainbow, Vic  3999\",\"line\":[\"534 Erewhon St\"],\"city\":\"PleasantVille\",\"district\":\"Rainbow\",\"state\":\"Vic\",\"postalCode\":\"3999\",\"period\":{\"start\":\"1974-12-25\"}}],\"contact\":[{\"relationship\":[{\"coding\":[{\"system\":\"http:\/\/hl7.org\/fhir\/v2\/0131\",\"code\":\"N\"}]}],\"name\":{\"family\":\"du March\u00E9\",\"_family\":{\"extension\":[{\"url\":\"http:\/\/hl7.org\/fhir\/StructureDefinition\/humanname-own-prefix\",\"valueString\":\"VV\"}]},\"given\":[\"B\u00E9n\u00E9dicte\"]},\"telecom\":[{\"system\":\"phone\",\"value\":\"+33 (237) 998327\"}],\"address\":{\"use\":\"home\",\"type\":\"both\",\"line\":[\"534 Erewhon St\"],\"city\":\"PleasantVille\",\"district\":\"Rainbow\",\"state\":\"Vic\",\"postalCode\":\"3999\",\"period\":{\"start\":\"1974-12-25\"}},\"gender\":\"female\",\"period\":{\"start\":\"2012\"}}],\"managingOrganization\":{\"reference\":\"Organization\/1\"}}");
}

document.getElementById('sample-diagnosticreport__link').onclick = function () {
  loadExample("{\"subject\":{\"reference\":\"Patient\/f201\",\"display\":\"Roel\"},\"id\":\"f201\",\"issued\":\"2012-12-01T12:00:00+01:00\",\"resourceType\":\"DiagnosticReport\",\"text\":{\"div\":\"<div xmlns='http:\/\/www.w3.org\/1999\/xhtml'>\\n  <p>\\n    <b>Generated Narrative with Details<\/b>\\n  <\/p>\\n  <p>\\n    <b>id<\/b>: f201<\/p>\\n  <p>\\n    <b>status<\/b>: final<\/p>\\n  <p>\\n    <b>category<\/b>: Radiology<span>(Details : {SNOMED CT code &apos;394914008&apos; = &apos;Radiology - specialty (qualifier value)&apos;, given\\n           as &apos;Radiology&apos;}; {http:\/\/hl7.org\/fhir\/v2\/0074 code &apos;RAD&apos; = &apos;Radiology)<\/span>\\n  <\/p>\\n  <p>\\n    <b>code<\/b>: CT of head-neck<span>(Details : {SNOMED CT code &apos;429858000&apos; = &apos;Computed tomography of head and neck (procedure)&apos;,\\n           given as &apos;Computed tomography (CT) of head and neck&apos;})<\/span>\\n  <\/p>\\n  <p>\\n    <b>subject<\/b>:<a>Roel<\/a>\\n  <\/p>\\n  <p>\\n    <b>effective<\/b>: Dec 1, 2012 12:00:00 PM<\/p>\\n  <p>\\n    <b>issued<\/b>: Dec 1, 2012 12:00:00 PM<\/p>\\n  <p>\\n    <b>performer<\/b>:<a>Blijdorp MC<\/a>\\n  <\/p>\\n  <p>\\n    <b>imagingStudy<\/b>: HEAD and NECK CT DICOM imaging study<\/p>\\n  <p>\\n    <b>conclusion<\/b>: CT brains: large tumor sphenoid\/clivus.<\/p>\\n  <p>\\n    <b>codedDiagnosis<\/b>: Malignant tumor of craniopharyngeal duct<span>(Details : {SNOMED CT code &apos;188340000&apos; = &apos;Malignant tumor of craniopharyngeal duct (disorder)&apos;,\\n           given as &apos;Malignant tumor of craniopharyngeal duct&apos;})<\/span>\\n  <\/p>\\n<\/div>\",\"status\":\"generated\"},\"imagingStudy\":[{\"display\":\"HEAD and NECK CT DICOM imaging study\"}],\"performer\":{\"reference\":\"Organization\/f203\",\"display\":\"Blijdorp MC\"},\"code\":{\"coding\":[{\"display\":\"Computed tomography (CT) of head and neck\",\"system\":\"http:\/\/snomed.info\/sct\",\"code\":\"429858000\"}],\"text\":\"CT of head-neck\"},\"effectiveDateTime\":\"2012-12-01T12:00:00+01:00\",\"codedDiagnosis\":[{\"coding\":[{\"display\":\"Malignant tumor of craniopharyngeal duct\",\"system\":\"http:\/\/snomed.info\/sct\",\"code\":\"188340000\"}]}],\"status\":\"final\",\"category\":{\"coding\":[{\"display\":\"Radiology\",\"system\":\"http:\/\/snomed.info\/sct\",\"code\":\"394914008\"},{\"code\":\"RAD\",\"system\":\"http:\/\/hl7.org\/fhir\/v2\/0074\"}]},\"conclusion\":\"CT brains: large tumor sphenoid\/clivus.\"}");
}

document.getElementById('json-edge-cases__link').onclick = function () {
  loadExample("{\"resourceType\":\"Patient\",\"identifier\":[{\"period\":{\"start\":\"2001-05-06\"},\"assigner\":{\"display\":\"Acme\u202FHealthcare\"},\"use\":\"usual\",\"system\":\"urn:oid:1.2.36.146.595.217.0.1\",\"value\":\"12345\"}],\"managingOrganization\":{\"reference\":\"Organization\/1\"},\"_active\":{\"extension\":[{\"url\":\"http:\/\/example.org\/fhir\/StructureDefinition\/recordStatus\",\"valueCode\":\"archived\"}]},\"name\":[{\"given\":[\"Peter\",\"James\"],\"use\":\"official\",\"family\":\"Chalmers\"},{\"given\":[\"Jim\"],\"use\":\"usual\"}],\"extension\":[{\"url\":\"http:\/\/example.org\/fhir\/StructureDefinition\/patientAvatar\",\"valueReference\":{\"reference\":\"#pic1\",\"display\":\"Duck image\"}},{\"url\":\"http:\/\/example.org\/fhir\/StructureDefinition\/complexExtensionExample\",\"extension\":[{\"url\":\"nestedA\",\"valueCoding\":{\"system\":\"http:\/\/demo.org\/id\/4\",\"code\":\"AB45\",\"extension\":[{\"url\":\"http:\/\/example.org\/fhir\/StructureDefinition\/extraforcodingWithExt\",\"extension\":[{\"url\":\"extra1\",\"valueString\":\"extra info\"}]},{\"url\":\"http:\/\/example.org\/fhir\/StructureDefinition\/extraforcodingWithValue\",\"valueInteger\":45}]}},{\"url\":\"nestedB\",\"id\":\"q4\",\"extension\":[{\"url\":\"nestedB1\",\"valueString\":\"hello\"}]}]}],\"modifierExtension\":[{\"url\":\"http:\/\/example.org\/fhir\/StructureDefinition\/pi\",\"valueDecimal\":3.141592653589793},{\"url\":\"http:\/\/example.org\/fhir\/StructureDefinition\/max-decimal-precision\",\"valueDecimal\":1.0006502214162465}],\"gender\":\"male\",\"birthDate\":\"1974-12\",\"deceasedBoolean\":true,\"address\":[{\"use\":\"home\",\"line\":[\"534 Erewhon St\"],\"city\":\"PleasantVille\",\"state\":\"Vic\",\"postalCode\":\"3999\"}],\"maritalStatus\":{\"extension\":[{\"url\":\"http:\/\/example.org\/fhir\/StructureDefinition\/nullFlavor\",\"valueCode\":\"ASKU\"}]},\"multipleBirthInteger\":3,\"text\":{\"status\":\"generated\",\"div\":\"<div xmlns=\\\"http:\/\/www.w3.org\/1999\/xhtml\\\">\\n      <table>\\n        <tbody>\\n          <tr>\\n            <td>Name<\/td>\\n            <td>Peter James <b>Chalmers<\/b> (&quot;Jim&quot;)<\/td>\\n          <\/tr>\\n          <tr>\\n            <td>Address<\/td>\\n            <td>534 Erewhon, Pleasantville, Vic, 3999<\/td>\\n          <\/tr>\\n          <tr>\\n            <td>Contacts<\/td>\\n            <td>Home: unknown. Work: (03) 5555 6473<\/td>\\n          <\/tr>\\n          <tr>\\n            <td>Id<\/td>\\n            <td>MRN: 12345 (Acme Healthcare)<\/td>\\n          <\/tr>\\n        <\/tbody>\\n      <\/table>\\n    <\/div>\"},\"contained\":[{\"resourceType\":\"Binary\",\"id\":\"pic1\",\"contentType\":\"image\/gif\",\"content\":\"R0lGODlhEwARAPcAAAAAAAAA\/+9aAO+1AP\/WAP\/eAP\/eCP\/eEP\/eGP\/nAP\/nCP\/nEP\/nIf\/nKf\/nUv\/nWv\/vAP\/vCP\/vEP\/vGP\/vIf\/vKf\/vMf\/vOf\/vWv\/vY\/\/va\/\/vjP\/3c\/\/3lP\/3nP\/\/tf\/\/vf\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/yH5BAEAAAEALAAAAAATABEAAAi+AAMIDDCgYMGBCBMSvMCQ4QCFCQcwDBGCA4cLDyEGECDxAoAQHjxwyKhQAMeGIUOSJJjRpIAGDS5wCDly4AALFlYOgHlBwwOSNydM0AmzwYGjBi8IHWoTgQYORg8QIGDAwAKhESI8HIDgwQaRDI1WXXAhK9MBBzZ8\/XDxQoUFZC9IiCBh6wEHGz6IbNuwQoSpWxEgyLCXL8O\/gAnylNlW6AUEBRIL7Og3KwQIiCXb9HsZQoIEUzUjNEiaNMKAAAA7\"},{\"resourceType\":\"Organization\",\"id\":\"org3141\",\"text\":{\"status\":\"generated\",\"div\":\"<div xmlns=\\\"http:\/\/www.w3.org\/1999\/xhtml\\\">\\n      <p>Good Health Clinic<\/p>\\n    <\/div>\"},\"identifier\":[{\"system\":\"urn:ietf:rfc:3986\",\"value\":\"2.16.840.1.113883.19.5\"}],\"name\":\"Good Health Clinic\"}],\"contact\":[{\"name\":{\"family\":\"du March\u00E9\",\"_family\":{\"extension\":[{\"url\":\"http:\/\/example.org\/fhir\/StructureDefinition\/qualifier\",\"valueString\":\"VV\"},{\"url\":\"http:\/\/hl7.org\/fhir\/StructureDefinitioniso-21090#nullFlavor\",\"valueCode\":\"ASKU\"}]},\"_given\":[null,{\"id\":\"a3\",\"extension\":[{\"url\":\"http:\/\/hl7.org\/fhir\/StructureDefinition\/qualifier\",\"valueCode\":\"MID\"}]},null],\"given\":[\"B\u00E9n\u00E9dicte\",\"Denise\",\"Marie\"]},\"relationship\":[{\"coding\":[{\"system\":\"http:\/\/hl7.org\/fhir\/patient-contact-relationship\",\"code\":\"partner\"}]}],\"telecom\":[{\"system\":\"phone\",\"value\":\"+33 (237) 998327\"}]}],\"generalPractitioner\":[{\"reference\":\"#org3141\"}],\"telecom\":[{\"use\":\"home\"},{\"system\":\"phone\",\"value\":\"(03) 5555 6473\",\"use\":\"work\"}]}");
}

document.getElementById("fhir-version-select").addEventListener("change", function() {
  // refresh views for the newly selected version
  if (sourceView && sourceView.codemirror.getValue() !== "") {
    sourceView.convertData(true);
  }
});

function linkToDialog(dialogQuery, linkQuery) {
  var dialog = document.querySelector(dialogQuery);
  var showDialogButton = document.querySelector(linkQuery);
  if (!dialog.showModal) {
    dialogPolyfill.registerDialog(dialog);
  }
  showDialogButton.addEventListener('click', function() {
    dialog.showModal();
    dialog.scrollTop = 0;
  });
  dialog.querySelector('.close').addEventListener('click', function() {
    dialog.close();
  });
}

// hook up 'Credits' link in footer to display a dialog
linkToDialog('#credits-dialog', '#credits');
// same for Privacy & Terms
linkToDialog('#privacy-and-terms-dialog', '#privacy-and-terms');
// and Help
linkToDialog('#help-dialog', '#help');


/* wraps text in an XML comment; "--" isn't allowed inside one, so split any run of hyphens */
function xmlComment(text) {
  return "<!--\n\n  " + text.replace(/-(?=-)/g, "- ") + "\n\n-->";
}

/* replaces the left view's "Loading resource..." message with a failure note */
function showResourceLoadError(resourceURL, reason) {
  console.warn("Failed to load resource from " + resourceURL + ": " + reason);
  leftFhirView.showMessage(xmlComment("Couldn't load resource from " + resourceURL + ": " + reason));
}

function downloadResource(resourceURL) {
  var requestURL;
  try {
    requestURL = new URL(resourceURL, window.location.href);
  } catch (e) {
    showResourceLoadError(resourceURL, "invalid URL");
    return;
  }
  requestURL.searchParams.set("_format", "json");

  var request = new XMLHttpRequest();
  request.open('GET', requestURL.href, true);

  request.onload = function() {
    if (request.status < 200 || request.status >= 400) {
      showResourceLoadError(resourceURL, "HTTP " + request.status + " " + request.statusText);
      return;
    }

    var jsonResource;
    try {
      jsonResource = JSON.parse(request.responseText);
    } catch (e) {
      showResourceLoadError(resourceURL, "response is not valid JSON (" + e.message + ")");
      return;
    }
    if (!jsonResource || typeof jsonResource !== "object") {
      showResourceLoadError(resourceURL, "response is not a JSON object");
      return;
    }

    /* strip out the big snapshot */
    delete jsonResource.snapshot;

    rightFhirView.showMessage(JSON.stringify(jsonResource, null, 2));
    if (!rightFhirView.convertData(true).ok) {
      leftFhirView.showMessage(xmlComment("Loaded resource from " + resourceURL +
        ", but couldn't convert it to XML (see the message under the JSON)."));
    }
  };

  request.onerror = function() {
    showResourceLoadError(resourceURL, "network error (the server may be unreachable or not allow cross-origin requests)");
  };

  request.send();
}

function getResourceParam() {
  return new URLSearchParams(window.location.search).get('loadResource');
}

function needToLoadResource() {
  return getResourceParam() ? true : false;
}

// load a resource from a given URL param if present
function loadResourceFromParams() {
  let loadResource = getResourceParam();

  if (!loadResource) { return; }

  console.log("Need to load: "+ loadResource);
  downloadResource(loadResource);
}
