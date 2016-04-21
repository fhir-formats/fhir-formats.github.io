function FhirInputView(el) {
  this.el = el;
  var codemirror = this.codemirror = CodeMirror.fromTextArea(this.el, {
    mode: {
      name: "javascript",
      json: true,
    },
    lineNumbers: true,
    lineWrapping: true,
    matchBrackets: false,
/*      matchTags: {
      bothTags: true
    }, */
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

    /* update code mirror's highlighting mode */
    codemirror.setOption("mode", looksLikeJson(text) ? "javascript" : "xml");
    /* convert data to other format and send to opposite codemirror */
    convertData();
  }

  /* updates data of codemirror as well as the cache */
  function setText(text, checkMode) {
    codemirror.setValue(text);
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
  leftFhirView.setText("<Patient xmlns='http://hl7.org/fhir'>\n  <identifier>\n    <type>\n      <coding>\n        <system value='http://hl7.org/fhir/v2/0203'/>\n        <code value='MR'/>\n      </coding>\n    </type>\n    <use value='usual'/>\n  </identifier>\n  <id value='example'/>\n</Patient>");
  document.querySelector('.mdl-layout').MaterialLayout.toggleDrawer();
}

  document.getElementById('full-patient__link').onclick = function () {
  rightFhirView.setText('{\r\n  \"resourceType\": \"Patient\",\r\n  \"id\": \"example\",\r\n  \"text\": {\r\n    \"status\": \"generated\",\r\n    \"div\": \"<div xmlns=\\\"http:\/\/www.w3.org\/1999\/xhtml\\\">\\n      \\n      <table>\\n        \\n        <tbody>\\n          \\n          <tr>\\n            \\n            <td>Name<\/td>\\n            \\n            <td>Peter James \\n              <b>Chalmers<\/b> (&quot;Jim&quot;)\\n            <\/td>\\n          \\n          <\/tr>\\n          \\n          <tr>\\n            \\n            <td>Address<\/td>\\n            \\n            <td>534 Erewhon, Pleasantville, Vic, 3999<\/td>\\n          \\n          <\/tr>\\n          \\n          <tr>\\n            \\n            <td>Contacts<\/td>\\n            \\n            <td>Home: unknown. Work: (03) 5555 6473<\/td>\\n          \\n          <\/tr>\\n          \\n          <tr>\\n            \\n            <td>Id<\/td>\\n            \\n            <td>MRN: 12345 (Acme Healthcare)<\/td>\\n          \\n          <\/tr>\\n        \\n        <\/tbody>\\n      \\n      <\/table>    \\n    \\n    <\/div>\"\r\n  },\r\n  \"identifier\": [\r\n    {\r\n      \"use\": \"usual\",\r\n      \"type\": {\r\n        \"coding\": [\r\n          {\r\n            \"system\": \"http:\/\/hl7.org\/fhir\/v2\/0203\",\r\n            \"code\": \"MR\"\r\n          }\r\n        ]\r\n      },\r\n      \"system\": \"urn:oid:1.2.36.146.595.217.0.1\",\r\n      \"value\": \"12345\",\r\n      \"period\": {\r\n        \"start\": \"2001-05-06\"\r\n      },\r\n      \"assigner\": {\r\n        \"display\": \"Acme Healthcare\"\r\n      }\r\n    }\r\n  ],\r\n  \"active\": true,\r\n  \"name\": [\r\n    {\r\n      \"use\": \"official\",\r\n      \"family\": [\r\n        \"Chalmers\"\r\n      ],\r\n      \"given\": [\r\n        \"Peter\",\r\n        \"James\"\r\n      ]\r\n    },\r\n    {\r\n      \"use\": \"usual\",\r\n      \"given\": [\r\n        \"Jim\"\r\n      ]\r\n    }\r\n  ],\r\n  \"telecom\": [\r\n    {\r\n      \"use\": \"home\"\r\n    },\r\n    {\r\n      \"system\": \"phone\",\r\n      \"value\": \"(03) 5555 6473\",\r\n      \"use\": \"work\"\r\n    }\r\n  ],\r\n  \"gender\": \"male\",\r\n  \"birthDate\": \"1974-12-25\",\r\n  \"_birthDate\": {\r\n    \"extension\": [\r\n      {\r\n        \"url\": \"http:\/\/hl7.org\/fhir\/StructureDefinition\/patient-birthTime\",\r\n        \"valueDateTime\": \"1974-12-25T14:35:45-05:00\"\r\n      }\r\n    ]\r\n  },\r\n  \"deceasedBoolean\": false,\r\n  \"address\": [\r\n    {\r\n      \"use\": \"home\",\r\n      \"type\": \"both\",\r\n      \"line\": [\r\n        \"534 Erewhon St\"\r\n      ],\r\n      \"city\": \"PleasantVille\",\r\n      \"district\": \"Rainbow\",\r\n      \"state\": \"Vic\",\r\n      \"postalCode\": \"3999\",\r\n      \"period\": {\r\n        \"start\": \"1974-12-25\"\r\n      }\r\n    }\r\n  ],\r\n  \"contact\": [\r\n    {\r\n      \"relationship\": [\r\n        {\r\n          \"coding\": [\r\n            {\r\n              \"system\": \"http:\/\/hl7.org\/fhir\/patient-contact-relationship\",\r\n              \"code\": \"partner\"\r\n            }\r\n          ]\r\n        }\r\n      ],\r\n      \"name\": {\r\n        \"family\": [\r\n          \"du\",\r\n          \"March\u00E9\"\r\n        ],\r\n        \"_family\": [\r\n          {\r\n            \"extension\": [\r\n              {\r\n                \"url\": \"http:\/\/hl7.org\/fhir\/StructureDefinition\/iso21090-EN-qualifier\",\r\n                \"valueCode\": \"VV\"\r\n              }\r\n            ]\r\n          },\r\n          null\r\n        ],\r\n        \"given\": [\r\n          \"B\u00E9n\u00E9dicte\"\r\n        ]\r\n      },\r\n      \"telecom\": [\r\n        {\r\n          \"system\": \"phone\",\r\n          \"value\": \"+33 (237) 998327\"\r\n        }\r\n      ],\r\n      \"gender\": \"female\",\r\n      \"period\": {\r\n        \"start\": \"2012\"\r\n      }\r\n    }\r\n  ],\r\n  \"managingOrganization\": {\r\n    \"reference\": \"Organization\/1\"\r\n  }\r\n}');
  document.querySelector('.mdl-layout').MaterialLayout.toggleDrawer();
}
