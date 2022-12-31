function FhirInputView(el) {
  this.el = el;
  updatedPaused = false;
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

  /* JSON starts with { or [ */
  function looksLikeJson(code) {
    return /^\s*[\{\[]/.test(code);
  }

  function pauseUpdates() {
    updatedPaused = true;
  }
  this.pauseUpdates = pauseUpdates;

  function unpauseUpdates() {
    updatedPaused = false;
  }
  this.unpauseUpdates = unpauseUpdates;

  function setRenderingMode(mode) {
    codemirror.setOption("mode", mode);
  }
  this.setRenderingMode = setRenderingMode

  var oldValue = '';
  /* updates mode of the codemirror and sends data for conversion */
  function updateMode() {
    if (updatedPaused) { return; }

    /* don't do anything if the data content is the same */
    var text = codemirror.getValue();
    if (text === oldValue) {
      return;
    }
    oldValue = text;

    if (text === "") {
      clearOtherView();
      return;
    }

    /* update code mirror's highlighting mode */
    codemirror.setOption("mode", looksLikeJson(text) ? "javascript" : "xml");
    /* convert data to other format and send to opposite codemirror */
    convertData();
  }

  /* updates data of codemirror as well as the cache, while keeping scroll position */
  function setText(text, checkMode) {
    var scrollInfo = codemirror.getScrollInfo();
    codemirror.setValue(text);
    codemirror.scrollTo(scrollInfo.left, scrollInfo.top);
    oldValue = text;

    if (checkMode) {
      codemirror.setOption("mode", looksLikeJson(text) ? "javascript" : "xml");
    }
  }
  this.setText = setText;

  function convertData() {
    var mode = codemirror.getOption("mode");
    var fhirVersion = document.getElementById("fhir-version-select").value;

    // try {
      var convertFunction = mode == "xml" ? "in_fhir_json" : "in_fhir_xml";
      // var result = L.execute("return " + convertFunction + "([[" + codemirror.getValue() + "]], {pretty = true})");
      var result = runLuaSafe(convertFunction + "([[" + codemirror.getValue() + "]], {pretty = true, fhirversion = '" + fhirVersion + "'})");
      /* can't pass which codemirror to send data to with callbacks, so figure it out here */
      var receivingView = leftFhirView.codemirror === codemirror ? rightFhirView : leftFhirView;
      receivingView.setText(result.join(), true);
    // } catch (e) {
    //   console.log(e.toString());
    // }
  }
  this.convertData = convertData;

  function clearOtherView() {
    var otherView = leftFhirView.codemirror === codemirror ? rightFhirView : leftFhirView;
    otherView.setText("");
  }

  var self = this;
}

function runLuaSafe(code) {
  var results = L.execute("return xpcall(function() return "+code+" end, function(e) return e..[[\n]]..debug.traceback() end)");
  if (results[0] === false) {
    console.log(code + '\n' + results.slice(1).join());
  } else {
    // ignore the first status code, return the rest of result
    return results.slice(1);
  }
}

var leftFhirView = new FhirInputView(document.getElementById('fhir-input-left'));
var rightFhirView = new FhirInputView(document.getElementById('fhir-input-right'));

document.getElementById('skeleton-patient__link').onclick = function () {
  var xml = runLuaSafe("in_fhir_xml[[{\"identifier\":[{\"type\":{\"coding\":[{\"code\":\"MR\",\"system\":\"http://hl7.org/fhir/v2/0203\"}]},\"use\":\"usual\"}],\"resourceType\":\"Patient\",\"id\":\"example\"}]]").join();
  leftFhirView.setText(xml);
  document.querySelector('.mdl-layout').MaterialLayout.toggleDrawer();
}

document.getElementById('full-patient__link').onclick = function () {
  var xml = runLuaSafe("in_fhir_xml[[{\"resourceType\":\"Patient\",\"id\":\"example\",\"text\":{\"status\":\"generated\",\"div\":\"<div xmlns=\\\"http:\/\/www.w3.org\/1999\/xhtml\\\">\\n\\t\\t\\t<table>\\n\\t\\t\\t\\t<tbody>\\n\\t\\t\\t\\t\\t<tr>\\n\\t\\t\\t\\t\\t\\t<td>Name<\/td>\\n\\t\\t\\t\\t\\t\\t<td>Peter James \\n              <b>Chalmers<\/b> (&quot;Jim&quot;)\\n            <\/td>\\n\\t\\t\\t\\t\\t<\/tr>\\n\\t\\t\\t\\t\\t<tr>\\n\\t\\t\\t\\t\\t\\t<td>Address<\/td>\\n\\t\\t\\t\\t\\t\\t<td>534 Erewhon, Pleasantville, Vic, 3999<\/td>\\n\\t\\t\\t\\t\\t<\/tr>\\n\\t\\t\\t\\t\\t<tr>\\n\\t\\t\\t\\t\\t\\t<td>Contacts<\/td>\\n\\t\\t\\t\\t\\t\\t<td>Home: unknown. Work: (03) 5555 6473<\/td>\\n\\t\\t\\t\\t\\t<\/tr>\\n\\t\\t\\t\\t\\t<tr>\\n\\t\\t\\t\\t\\t\\t<td>Id<\/td>\\n\\t\\t\\t\\t\\t\\t<td>MRN: 12345 (Acme Healthcare)<\/td>\\n\\t\\t\\t\\t\\t<\/tr>\\n\\t\\t\\t\\t<\/tbody>\\n\\t\\t\\t<\/table>\\n\\t\\t<\/div>\"},\"identifier\":[{\"use\":\"usual\",\"type\":{\"coding\":[{\"system\":\"http:\/\/hl7.org\/fhir\/v2\/0203\",\"code\":\"MR\"}]},\"system\":\"urn:oid:1.2.36.146.595.217.0.1\",\"value\":\"12345\",\"period\":{\"start\":\"2001-05-06\"},\"assigner\":{\"display\":\"Acme Healthcare\"}}],\"active\":true,\"name\":[{\"use\":\"official\",\"family\":\"Chalmers\",\"given\":[\"Peter\",\"James\"]},{\"use\":\"usual\",\"given\":[\"Jim\"]},{\"use\":\"maiden\",\"family\":\"Windsor\",\"given\":[\"Peter\",\"James\"],\"period\":{\"end\":\"2002\"}}],\"telecom\":[{\"use\":\"home\"},{\"system\":\"phone\",\"value\":\"(03) 5555 6473\",\"use\":\"work\",\"rank\":1},{\"system\":\"phone\",\"value\":\"(03) 3410 5613\",\"use\":\"mobile\",\"rank\":2},{\"system\":\"phone\",\"value\":\"(03) 5555 8834\",\"use\":\"old\",\"period\":{\"end\":\"2014\"}}],\"gender\":\"male\",\"birthDate\":\"1974-12-25\",\"_birthDate\":{\"extension\":[{\"url\":\"http:\/\/hl7.org\/fhir\/StructureDefinition\/patient-birthTime\",\"valueDateTime\":\"1974-12-25T14:35:45-05:00\"}]},\"deceasedBoolean\":false,\"address\":[{\"use\":\"home\",\"type\":\"both\",\"text\":\"534 Erewhon St PeasantVille, Rainbow, Vic  3999\",\"line\":[\"534 Erewhon St\"],\"city\":\"PleasantVille\",\"district\":\"Rainbow\",\"state\":\"Vic\",\"postalCode\":\"3999\",\"period\":{\"start\":\"1974-12-25\"}}],\"contact\":[{\"relationship\":[{\"coding\":[{\"system\":\"http:\/\/hl7.org\/fhir\/v2\/0131\",\"code\":\"N\"}]}],\"name\":{\"family\":\"du March\u00E9\",\"_family\":{\"extension\":[{\"url\":\"http:\/\/hl7.org\/fhir\/StructureDefinition\/humanname-own-prefix\",\"valueString\":\"VV\"}]},\"given\":[\"B\u00E9n\u00E9dicte\"]},\"telecom\":[{\"system\":\"phone\",\"value\":\"+33 (237) 998327\"}],\"address\":{\"use\":\"home\",\"type\":\"both\",\"line\":[\"534 Erewhon St\"],\"city\":\"PleasantVille\",\"district\":\"Rainbow\",\"state\":\"Vic\",\"postalCode\":\"3999\",\"period\":{\"start\":\"1974-12-25\"}},\"gender\":\"female\",\"period\":{\"start\":\"2012\"}}],\"managingOrganization\":{\"reference\":\"Organization\/1\"}}]]").join();
  leftFhirView.setText(xml);
  document.querySelector('.mdl-layout').MaterialLayout.toggleDrawer();
}

document.getElementById('sample-diagnosticreport__link').onclick = function () {
  var xml = runLuaSafe("in_fhir_xml[[{\"subject\":{\"reference\":\"Patient\/f201\",\"display\":\"Roel\"},\"id\":\"f201\",\"issued\":\"2012-12-01T12:00:00+01:00\",\"resourceType\":\"DiagnosticReport\",\"text\":{\"div\":\"<div xmlns='http:\/\/www.w3.org\/1999\/xhtml'>\\n  <p>\\n    <b>Generated Narrative with Details<\/b>\\n  <\/p>\\n  <p>\\n    <b>id<\/b>: f201<\/p>\\n  <p>\\n    <b>status<\/b>: final<\/p>\\n  <p>\\n    <b>category<\/b>: Radiology<span>(Details : {SNOMED CT code &apos;394914008&apos; = &apos;Radiology - specialty (qualifier value)&apos;, given\\n           as &apos;Radiology&apos;}; {http:\/\/hl7.org\/fhir\/v2\/0074 code &apos;RAD&apos; = &apos;Radiology)<\/span>\\n  <\/p>\\n  <p>\\n    <b>code<\/b>: CT of head-neck<span>(Details : {SNOMED CT code &apos;429858000&apos; = &apos;Computed tomography of head and neck (procedure)&apos;,\\n           given as &apos;Computed tomography (CT) of head and neck&apos;})<\/span>\\n  <\/p>\\n  <p>\\n    <b>subject<\/b>:<a>Roel<\/a>\\n  <\/p>\\n  <p>\\n    <b>effective<\/b>: Dec 1, 2012 12:00:00 PM<\/p>\\n  <p>\\n    <b>issued<\/b>: Dec 1, 2012 12:00:00 PM<\/p>\\n  <p>\\n    <b>performer<\/b>:<a>Blijdorp MC<\/a>\\n  <\/p>\\n  <p>\\n    <b>imagingStudy<\/b>: HEAD and NECK CT DICOM imaging study<\/p>\\n  <p>\\n    <b>conclusion<\/b>: CT brains: large tumor sphenoid\/clivus.<\/p>\\n  <p>\\n    <b>codedDiagnosis<\/b>: Malignant tumor of craniopharyngeal duct<span>(Details : {SNOMED CT code &apos;188340000&apos; = &apos;Malignant tumor of craniopharyngeal duct (disorder)&apos;,\\n           given as &apos;Malignant tumor of craniopharyngeal duct&apos;})<\/span>\\n  <\/p>\\n<\/div>\",\"status\":\"generated\"},\"imagingStudy\":[{\"display\":\"HEAD and NECK CT DICOM imaging study\"}],\"performer\":{\"reference\":\"Organization\/f203\",\"display\":\"Blijdorp MC\"},\"code\":{\"coding\":[{\"display\":\"Computed tomography (CT) of head and neck\",\"system\":\"http:\/\/snomed.info\/sct\",\"code\":\"429858000\"}],\"text\":\"CT of head-neck\"},\"effectiveDateTime\":\"2012-12-01T12:00:00+01:00\",\"codedDiagnosis\":[{\"coding\":[{\"display\":\"Malignant tumor of craniopharyngeal duct\",\"system\":\"http:\/\/snomed.info\/sct\",\"code\":\"188340000\"}]}],\"status\":\"final\",\"category\":{\"coding\":[{\"display\":\"Radiology\",\"system\":\"http:\/\/snomed.info\/sct\",\"code\":\"394914008\"},{\"code\":\"RAD\",\"system\":\"http:\/\/hl7.org\/fhir\/v2\/0074\"}]},\"conclusion\":\"CT brains: large tumor sphenoid\/clivus.\"}]]").join();
  leftFhirView.setText(xml);
  document.querySelector('.mdl-layout').MaterialLayout.toggleDrawer();
}

document.getElementById('json-edge-cases__link').onclick = function () {
  var xml = runLuaSafe("in_fhir_xml[[{\"resourceType\":\"Patient\",\"identifier\":[{\"period\":{\"start\":\"2001-05-06\"},\"assigner\":{\"display\":\"Acme\u202FHealthcare\"},\"use\":\"usual\",\"system\":\"urn:oid:1.2.36.146.595.217.0.1\",\"value\":\"12345\"}],\"managingOrganization\":{\"reference\":\"Organization\/1\"},\"_active\":{\"extension\":[{\"url\":\"http:\/\/example.org\/fhir\/StructureDefinition\/recordStatus\",\"valueCode\":\"archived\"}]},\"name\":[{\"given\":[\"Peter\",\"James\"],\"use\":\"official\",\"family\":\"Chalmers\"},{\"given\":[\"Jim\"],\"use\":\"usual\"}],\"extension\":[{\"url\":\"http:\/\/example.org\/fhir\/StructureDefinition\/patientAvatar\",\"valueReference\":{\"reference\":\"#pic1\",\"display\":\"Duck image\"}},{\"url\":\"http:\/\/example.org\/fhir\/StructureDefinition\/complexExtensionExample\",\"extension\":[{\"url\":\"nestedA\",\"valueCoding\":{\"system\":\"http:\/\/demo.org\/id\/4\",\"code\":\"AB45\",\"extension\":[{\"url\":\"http:\/\/example.org\/fhir\/StructureDefinition\/extraforcodingWithExt\",\"extension\":[{\"url\":\"extra1\",\"valueString\":\"extra info\"}]},{\"url\":\"http:\/\/example.org\/fhir\/StructureDefinition\/extraforcodingWithValue\",\"valueInteger\":45}]}},{\"url\":\"nestedB\",\"id\":\"q4\",\"extension\":[{\"url\":\"nestedB1\",\"valueString\":\"hello\"}]}]}],\"modifierExtension\":[{\"url\":\"http:\/\/example.org\/fhir\/StructureDefinition\/pi\",\"valueDecimal\":3.141592653589793},{\"url\":\"http:\/\/example.org\/fhir\/StructureDefinition\/max-decimal-precision\",\"valueDecimal\":1.0006502214162465}],\"gender\":\"male\",\"birthDate\":\"1974-12\",\"deceasedBoolean\":true,\"address\":[{\"use\":\"home\",\"line\":[\"534 Erewhon St\"],\"city\":\"PleasantVille\",\"state\":\"Vic\",\"postalCode\":\"3999\"}],\"maritalStatus\":{\"extension\":[{\"url\":\"http:\/\/example.org\/fhir\/StructureDefinition\/nullFlavor\",\"valueCode\":\"ASKU\"}]},\"multipleBirthInteger\":3,\"text\":{\"status\":\"generated\",\"div\":\"<div xmlns=\\\"http:\/\/www.w3.org\/1999\/xhtml\\\">\\n      <table>\\n        <tbody>\\n          <tr>\\n            <td>Name<\/td>\\n            <td>Peter James <b>Chalmers<\/b> (&quot;Jim&quot;)<\/td>\\n          <\/tr>\\n          <tr>\\n            <td>Address<\/td>\\n            <td>534 Erewhon, Pleasantville, Vic, 3999<\/td>\\n          <\/tr>\\n          <tr>\\n            <td>Contacts<\/td>\\n            <td>Home: unknown. Work: (03) 5555 6473<\/td>\\n          <\/tr>\\n          <tr>\\n            <td>Id<\/td>\\n            <td>MRN: 12345 (Acme Healthcare)<\/td>\\n          <\/tr>\\n        <\/tbody>\\n      <\/table>\\n    <\/div>\"},\"contained\":[{\"resourceType\":\"Binary\",\"id\":\"pic1\",\"contentType\":\"image\/gif\",\"content\":\"R0lGODlhEwARAPcAAAAAAAAA\/+9aAO+1AP\/WAP\/eAP\/eCP\/eEP\/eGP\/nAP\/nCP\/nEP\/nIf\/nKf\/nUv\/nWv\/vAP\/vCP\/vEP\/vGP\/vIf\/vKf\/vMf\/vOf\/vWv\/vY\/\/va\/\/vjP\/3c\/\/3lP\/3nP\/\/tf\/\/vf\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/yH5BAEAAAEALAAAAAATABEAAAi+AAMIDDCgYMGBCBMSvMCQ4QCFCQcwDBGCA4cLDyEGECDxAoAQHjxwyKhQAMeGIUOSJJjRpIAGDS5wCDly4AALFlYOgHlBwwOSNydM0AmzwYGjBi8IHWoTgQYORg8QIGDAwAKhESI8HIDgwQaRDI1WXXAhK9MBBzZ8\/XDxQoUFZC9IiCBh6wEHGz6IbNuwQoSpWxEgyLCXL8O\/gAnylNlW6AUEBRIL7Og3KwQIiCXb9HsZQoIEUzUjNEiaNMKAAAA7\"},{\"resourceType\":\"Organization\",\"id\":\"org3141\",\"text\":{\"status\":\"generated\",\"div\":\"<div xmlns=\\\"http:\/\/www.w3.org\/1999\/xhtml\\\">\\n      <p>Good Health Clinic<\/p>\\n    <\/div>\"},\"identifier\":[{\"system\":\"urn:ietf:rfc:3986\",\"value\":\"2.16.840.1.113883.19.5\"}],\"name\":\"Good Health Clinic\"}],\"contact\":[{\"name\":{\"family\":\"du March\u00E9\",\"_family\":{\"extension\":[{\"url\":\"http:\/\/example.org\/fhir\/StructureDefinition\/qualifier\",\"valueString\":\"VV\"},{\"url\":\"http:\/\/hl7.org\/fhir\/StructureDefinitioniso-21090#nullFlavor\",\"valueCode\":\"ASKU\"}]},\"_given\":[null,{\"id\":\"a3\",\"extension\":[{\"url\":\"http:\/\/hl7.org\/fhir\/StructureDefinition\/qualifier\",\"valueCode\":\"MID\"}]},null],\"given\":[\"B\u00E9n\u00E9dicte\",\"Denise\",\"Marie\"]},\"relationship\":[{\"coding\":[{\"system\":\"http:\/\/hl7.org\/fhir\/patient-contact-relationship\",\"code\":\"partner\"}]}],\"telecom\":[{\"system\":\"phone\",\"value\":\"+33 (237) 998327\"}]}],\"generalPractitioner\":[{\"reference\":\"#org3141\"}],\"telecom\":[{\"use\":\"home\"},{\"system\":\"phone\",\"value\":\"(03) 5555 6473\",\"use\":\"work\"}]}]]").join();
  leftFhirView.setText(xml);
  document.querySelector('.mdl-layout').MaterialLayout.toggleDrawer();
}

document.getElementById("fhir-version-select").addEventListener("change", function() {
  // refresh views for the newly selected version
  leftFhirView.convertData();
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


function downloadResource(resourceURL) {
  var request = new XMLHttpRequest();
  request.open('GET', resourceURL+"?_format=json", true);

  request.onload = function() {
    if (request.status >= 200 && request.status < 400) {
      var jsonResource = JSON.parse(request.responseText);
      if (!jsonResource) {
        console.log('Invalid JSON data received from '+resourceURL);
        return;
      }

      /* strip out the big snapshot */
      delete jsonResource.snapshot;

      rightFhirView.setText(JSON.stringify(jsonResource));
    }
  };

  request.onerror = function() {
    console.log('Failed to download resource from: '+ resourceURL);
  };

  request.send();
}

function getResourceParam() {
  let params = window.location.search
    .substring(1)
    .split("&")
    .map(v => v.split("="))
    .reduce((map, [key, value]) => map.set(key, decodeURIComponent(value)), new Map());
  return params.get('loadResource');
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
