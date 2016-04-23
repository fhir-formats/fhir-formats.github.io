function FhirInputView(el) {
  this.el = el;
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

  var oldValue = '';
  /* updates mode of the codemirror and sends data for conversion */
  function updateMode() {
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
    // try {
      var convertFunction = mode == "xml" ? "in_fhir_json" : "in_fhir_xml";
      // var result = L.execute("return " + convertFunction + "([[" + codemirror.getValue() + "]], {pretty = true})");
      var result = runLuaSafe(convertFunction + "([[" + codemirror.getValue() + "]], {pretty = true})");
      /* can't pass which codemirror to send data to with callbacks, so figure it out here */
      var receivingView = leftFhirView.codemirror === codemirror ? rightFhirView : leftFhirView;
      receivingView.setText(result.join(), true);
    // } catch (e) {
    //   console.log(e.toString());
    // }
  }

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
    var xml = runLuaSafe("in_fhir_xml[[{\"_birthDate\":{\"extension\":[{\"valueDateTime\":\"1974-12-25T14:35:45-05:00\",\"url\":\"http://hl7.org/fhir/StructureDefinition/patient-birthTime\"}]},\"contact\":[{\"relationship\":[{\"coding\":[{\"code\":\"partner\",\"system\":\"http://hl7.org/fhir/patient-contact-relationship\"}]}],\"gender\":\"female\",\"period\":{\"start\":\"2012\"},\"name\":{\"family\":[\"du\",\"Marché\"],\"_family\":[{\"extension\":[{\"valueCode\":\"VV\",\"url\":\"http://hl7.org/fhir/StructureDefinition/iso21090-EN-qualifier\"}]},null],\"given\":[\"Bénédicte\"]},\"telecom\":[{\"system\":\"phone\",\"value\":\"+33 (237) 998327\"}]}],\"id\":\"example\",\"address\":[{\"use\":\"home\",\"postalCode\":\"3999\",\"city\":\"PleasantVille\",\"line\":[\"534 Erewhon St\"],\"period\":{\"start\":\"1974-12-25\"},\"type\":\"both\",\"district\":\"Rainbow\",\"state\":\"Vic\"}],\"telecom\":[{\"use\":\"home\"},{\"use\":\"work\",\"system\":\"phone\",\"value\":\"(03) 5555 6473\"}],\"resourceType\":\"Patient\",\"active\":true,\"birthDate\":\"1974-12-25\",\"deceasedBoolean\":false,\"text\":{\"status\":\"generated\",\"div\":\"<div xmlns='http://www.w3.org/1999/xhtml'>\\n  <table>\\n    <tbody>\\n      <tr>\\n        <td>Name</td>\\n        <td>Peter James<b>Chalmers</b>(\\\"Jim\\\")</td>\\n      </tr>\\n      <tr>\\n        <td>Address</td>\\n        <td>534 Erewhon, Pleasantville, Vic, 3999</td>\\n      </tr>\\n      <tr>\\n        <td>Contacts</td>\\n        <td>Home: unknown. Work: (03) 5555 6473</td>\\n      </tr>\\n      <tr>\\n        <td>Id</td>\\n        <td>MRN: 12345 (Acme Healthcare)</td>\\n      </tr>\\n    </tbody>\\n  </table>\\n</div>\"},\"gender\":\"male\",\"identifier\":[{\"use\":\"usual\",\"system\":\"urn:oid:1.2.36.146.595.217.0.1\",\"period\":{\"start\":\"2001-05-06\"},\"type\":{\"coding\":[{\"code\":\"MR\",\"system\":\"http://hl7.org/fhir/v2/0203\"}]},\"assigner\":{\"display\":\"Acme Healthcare\"},\"value\":\"12345\"}],\"name\":[{\"use\":\"official\",\"given\":[\"Peter\",\"James\"],\"family\":[\"Chalmers\"]},{\"given\":[\"Jim\"],\"use\":\"usual\"}],\"managingOrganization\":{\"reference\":\"Organization/1\"}}]]").join();
    leftFhirView.setText(xml);
  document.querySelector('.mdl-layout').MaterialLayout.toggleDrawer();
}

// hook up 'Credit' link in footer to display a dialog
var dialog = document.querySelector('dialog');
var showDialogButton = document.querySelector('#credit');
if (!dialog.showModal) {
  dialogPolyfill.registerDialog(dialog);
}
showDialogButton.addEventListener('click', function() {
  dialog.showModal();
});
dialog.querySelector('.close').addEventListener('click', function() {
  dialog.close();
});
