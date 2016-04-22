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
  leftFhirView.setText("<Patient xmlns='http://hl7.org/fhir'>\n  <active value='true'/>\n  <gender value='male'/>\n  <address>\n    <period>\n      <start value='1974-12-25'/>\n    </period>\n    <line value='534 Erewhon St'/>\n    <district value='Rainbow'/>\n    <use value='home'/>\n    <state value='Vic'/>\n    <city value='PleasantVille'/>\n    <postalCode value='3999'/>\n    <type value='both'/>\n  </address>\n  <contact>\n    <name>\n      <given value='Bénédicte'/>\n      <family value='du'>\n        <extension url='http://hl7.org/fhir/StructureDefinition/iso21090-EN-qualifier'>\n          <valueCode value='VV'/>\n        </extension>\n      </family>\n      <family value='Marché'/>\n    </name>\n    <gender value='female'/>\n    <period>\n      <start value='2012'/>\n    </period>\n    <relationship>\n      <coding>\n        <code value='partner'/>\n        <system value='http://hl7.org/fhir/patient-contact-relationship'/>\n      </coding>\n    </relationship>\n    <telecom>\n      <value value='+33 (237) 998327'/>\n      <system value='phone'/>\n    </telecom>\n  </contact>\n  <telecom>\n    <use value='home'/>\n  </telecom>\n  <telecom>\n    <system value='phone'/>\n    <use value='work'/>\n    <value value='(03) 5555 6473'/>\n  </telecom>\n  <name>\n    <family value='Chalmers'/>\n    <given value='Peter'/>\n    <given value='James'/>\n    <use value='official'/>\n  </name>\n  <name>\n    <given value='Jim'/>\n    <use value='usual'/>\n  </name>\n  <birthDate value='1974-12-25'>\n    <extension url='http://hl7.org/fhir/StructureDefinition/patient-birthTime'>\n      <valueDateTime value='1974-12-25T14:35:45-05:00'/>\n    </extension>\n  </birthDate>\n  <managingOrganization>\n    <reference value='Organization/1'/>\n  </managingOrganization>\n  <deceasedBoolean value='false'/>\n  <identifier>\n    <type>\n      <coding>\n        <code value='MR'/>\n        <system value='http://hl7.org/fhir/v2/0203'/>\n      </coding>\n    </type>\n    <use value='usual'/>\n    <assigner>\n      <display value='Acme Healthcare'/>\n    </assigner>\n    <system value='urn:oid:1.2.36.146.595.217.0.1'/>\n    <period>\n      <start value='2001-05-06'/>\n    </period>\n    <value value='12345'/>\n  </identifier>\n  <id value='example'/>\n  <text>\n    <div xmlns='http://www.w3.org/1999/xhtml'>\n      <table>\n        <tbody>\n          <tr>\n            <td>Name</td>\n            <td>Peter James<b>Chalmers</b>(\"Jim\")</td>\n          </tr>\n          <tr>\n            <td>Address</td>\n            <td>534 Erewhon, Pleasantville, Vic, 3999</td>\n          </tr>\n          <tr>\n            <td>Contacts</td>\n            <td>Home: unknown. Work: (03) 5555 6473</td>\n          </tr>\n          <tr>\n            <td>Id</td>\n            <td>MRN: 12345 (Acme Healthcare)</td>\n          </tr>\n        </tbody>\n      </table>\n    </div>\n    <status value='generated'/>\n  </text>\n</Patient>");
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
