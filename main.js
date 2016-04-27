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
  document.getElementById('sample-diagnosticreport__link').onclick = function () {
    var xml = runLuaSafe("in_fhir_xml[[{\"subject\":{\"reference\":\"Patient\/f201\",\"display\":\"Roel\"},\"id\":\"f201\",\"issued\":\"2012-12-01T12:00:00+01:00\",\"resourceType\":\"DiagnosticReport\",\"text\":{\"div\":\"<div xmlns='http:\/\/www.w3.org\/1999\/xhtml'>\\n  <p>\\n    <b>Generated Narrative with Details<\/b>\\n  <\/p>\\n  <p>\\n    <b>id<\/b>: f201<\/p>\\n  <p>\\n    <b>status<\/b>: final<\/p>\\n  <p>\\n    <b>category<\/b>: Radiology<span>(Details : {SNOMED CT code &apos;394914008&apos; = &apos;Radiology - specialty (qualifier value)&apos;, given\\n           as &apos;Radiology&apos;}; {http:\/\/hl7.org\/fhir\/v2\/0074 code &apos;RAD&apos; = &apos;Radiology)<\/span>\\n  <\/p>\\n  <p>\\n    <b>code<\/b>: CT of head-neck<span>(Details : {SNOMED CT code &apos;429858000&apos; = &apos;Computed tomography of head and neck (procedure)&apos;,\\n           given as &apos;Computed tomography (CT) of head and neck&apos;})<\/span>\\n  <\/p>\\n  <p>\\n    <b>subject<\/b>:<a>Roel<\/a>\\n  <\/p>\\n  <p>\\n    <b>effective<\/b>: Dec 1, 2012 12:00:00 PM<\/p>\\n  <p>\\n    <b>issued<\/b>: Dec 1, 2012 12:00:00 PM<\/p>\\n  <p>\\n    <b>performer<\/b>:<a>Blijdorp MC<\/a>\\n  <\/p>\\n  <p>\\n    <b>imagingStudy<\/b>: HEAD and NECK CT DICOM imaging study<\/p>\\n  <p>\\n    <b>conclusion<\/b>: CT brains: large tumor sphenoid\/clivus.<\/p>\\n  <p>\\n    <b>codedDiagnosis<\/b>: Malignant tumor of craniopharyngeal duct<span>(Details : {SNOMED CT code &apos;188340000&apos; = &apos;Malignant tumor of craniopharyngeal duct (disorder)&apos;,\\n           given as &apos;Malignant tumor of craniopharyngeal duct&apos;})<\/span>\\n  <\/p>\\n<\/div>\",\"status\":\"generated\"},\"imagingStudy\":[{\"display\":\"HEAD and NECK CT DICOM imaging study\"}],\"performer\":{\"reference\":\"Organization\/f203\",\"display\":\"Blijdorp MC\"},\"code\":{\"coding\":[{\"display\":\"Computed tomography (CT) of head and neck\",\"system\":\"http:\/\/snomed.info\/sct\",\"code\":\"429858000\"}],\"text\":\"CT of head-neck\"},\"effectiveDateTime\":\"2012-12-01T12:00:00+01:00\",\"codedDiagnosis\":[{\"coding\":[{\"display\":\"Malignant tumor of craniopharyngeal duct\",\"system\":\"http:\/\/snomed.info\/sct\",\"code\":\"188340000\"}]}],\"status\":\"final\",\"category\":{\"coding\":[{\"display\":\"Radiology\",\"system\":\"http:\/\/snomed.info\/sct\",\"code\":\"394914008\"},{\"code\":\"RAD\",\"system\":\"http:\/\/hl7.org\/fhir\/v2\/0074\"}]},\"conclusion\":\"CT brains: large tumor sphenoid\/clivus.\"}]]").join();
    leftFhirView.setText(xml);
  document.querySelector('.mdl-layout').MaterialLayout.toggleDrawer();
}
  
document.getElementById('json-edge-cases__link').onclick = function () {
    var xml = runLuaSafe("in_fhir_xml[[{\"resourceType\":\"Patient\",\"identifier\":[{\"period\":{\"start\":\"2001-05-06\"},\"assigner\":{\"display\":\"Acme\\u202fHealthcare\"},\"use\":\"usual\",\"system\":\"urn:oid:1.2.36.146.595.217.0.1\",\"value\":\"12345\"}],\"_active\":{\"extension\":[{\"url\":\"http:\/\/example.org\/fhir\/StructureDefinition\/recordStatus\",\"valueCode\":\"archived\"}]},\"name\":[{\"given\":[\"Peter\",\"James\"],\"use\":\"official\",\"family\":[\"Chalmers\"]},{\"given\":[\"Jim\"],\"use\":\"usual\"}],\"extension\":[{\"url\":\"http:\/\/example.org\/fhir\/StructureDefinition\/patientAvatar\",\"valueReference\":{\"reference\":\"#pic1\",\"display\":\"Duck image\"}},{\"url\":\"http:\/\/example.org\/fhir\/StructureDefinition\/complexExtensionExample\",\"extension\":[{\"url\":\"nestedA\",\"valueCoding\":{\"system\":\"http:\/\/demo.org\/id\/4\",\"code\":\"AB45\",\"extension\":[{\"url\":\"http:\/\/example.org\/fhir\/StructureDefinition\/extraforcodingWithExt\",\"extension\":[{\"url\":\"extra1\",\"valueString\":\"extra info\"}]},{\"url\":\"http:\/\/example.org\/fhir\/StructureDefinition\/extraforcodingWithValue\",\"valueInteger\":45}]}},{\"url\":\"nestedB\",\"id\":\"q4\",\"extension\":[{\"url\":\"nestedB1\",\"valueString\":\"hello\"}]}]}],\"modifierExtension\":[{\"url\":\"http:\/\/example.org\/fhir\/StructureDefinition\/pi\",\"valueDecimal\":3.1415926535898},{\"url\":\"http:\/\/example.org\/fhir\/StructureDefinition\/avogadro\",\"valueDecimal\":6.0221416246424E23}],\"gender\":\"male\",\"birthDate\":\"1974-12\",\"deceasedBoolean\":true,\"address\":[{\"use\":\"home\",\"line\":[\"534 Erewhon St\"],\"city\":\"PleasantVille\",\"state\":\"Vic\",\"postalCode\":\"3999\"}],\"maritalStatus\":{\"coding\":[{\"system\":\"http:\/\/hl7.org\/fhir\/v3\/NullFlavor\",\"code\":\"UNK\",\"display\":\"unknown\"}]},\"multipleBirthInteger\":3,\"text\":{\"status\":\"generated\",\"div\":\"<div xmlns=\\\"http:\/\/www.w3.org\/1999\/xhtml\\\">\\n      <table>\\n        <tbody>\\n          <tr>\\n            <td>Name<\\\/td>\\n            <td>Peter James <b>Chalmers<\\\/b> (&quot;Jim&quot;)<\\\/td>\\n          <\\\/tr>\\n          <tr>\\n            <td>Address<\\\/td>\\n            <td>534 Erewhon, Pleasantville, Vic, 3999<\\\/td>\\n          <\\\/tr>\\n          <tr>\\n            <td>Contacts<\\\/td>\\n            <td>Home: unknown. Work: (03) 5555 6473<\\\/td>\\n          <\\\/tr>\\n          <tr>\\n            <td>Id<\\\/td>\\n            <td>MRN: 12345 (Acme Healthcare)<\\\/td>\\n          <\\\/tr>\\n        <\\\/tbody>\\n      <\\\/table>\\n    <\\\/div>\"},\"contained\":[{\"resourceType\":\"Binary\",\"id\":\"pic1\",\"contentType\":\"image\/gif\",\"content\":\"R0lGODlhEwARAPcAAAAAAAAA\/+9aAO+1AP\/WAP\/eAP\/eCP\/eEP\/eGP\/nAP\/nCP\/nEP\/nIf\/nKf\/nUv\/nWv\/vAP\/vCP\/vEP\/vGP\/vIf\/vKf\/vMf\/vOf\/vWv\/vY\/\/va\/\/vjP\/3c\/\/3lP\/3nP\/\/tf\/\/vf\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/yH5BAEAAAEALAAAAAATABEAAAi+AAMIDDCgYMGBCBMSvMCQ4QCFCQcwDBGCA4cLDyEGECDxAoAQHjxwyKhQAMeGIUOSJJjRpIAGDS5wCDly4AALFlYOgHlBwwOSNydM0AmzwYGjBi8IHWoTgQYORg8QIGDAwAKhESI8HIDgwQaRDI1WXXAhK9MBBzZ8\/XDxQoUFZC9IiCBh6wEHGz6IbNuwQoSpWxEgyLCXL8O\/gAnylNlW6AUEBRIL7Og3KwQIiCXb9HsZQoIEUzUjNEiaNMKAAAA7\"},{\"resourceType\":\"Organization\",\"id\":\"org3141\",\"identifier\":[{\"system\":\"urn:ietf:rfc:3986\",\"value\":\"2.16.840.1.113883.19.5\"}],\"name\":\"Good Health Clinic\"}],\"contact\":[{\"name\":{\"family\":[null,\"du\",null,\"March\u00e9\",null],\"_family\":[{\"extension\":[{\"url\":\"http:\/\/example.org\/fhir\/StructureDefinition\/nullFlavor\",\"valueCode\":\"ASKU\"}]},{\"id\":\"a2\",\"extension\":[{\"url\":\"http:\/\/example.org\/fhir\/StructureDefinition\/qualifier\",\"valueCode\":\"VV\"}]},{\"extension\":[{\"url\":\"http:\/\/hl7.org\/fhir\/StructureDefinitioniso-21090#nullFlavor\",\"valueCode\":\"ASKU\"}]},null,{\"extension\":[{\"url\":\"http:\/\/hl7.org\/fhir\/StructureDefinition\/nullFlavor\",\"valueCode\":\"ASKU\"}]}],\"_given\":[null,{\"id\":\"a3\",\"extension\":[{\"url\":\"http:\/\/hl7.org\/fhir\/StructureDefinition\/qualifier\",\"valueCode\":\"MID\"}]},null],\"given\":[\"B\u00e9n\u00e9dicte\",\"Denise\",\"Marie\"]},\"relationship\":[{\"coding\":[{\"system\":\"http:\/\/hl7.org\/fhir\/patient-contact-relationship\",\"code\":\"partner\"}]}],\"telecom\":[{\"system\":\"phone\",\"value\":\"+33 (237) 998327\"}]}],\"careProvider\":[{\"reference\":\"#org3141\"}],\"telecom\":[{\"use\":\"home\"},{\"system\":\"phone\",\"value\":\"(03) 5555 6473\",\"use\":\"work\"}]}]]").join();
    leftFhirView.setText(xml);
  document.querySelector('.mdl-layout').MaterialLayout.toggleDrawer();
}

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