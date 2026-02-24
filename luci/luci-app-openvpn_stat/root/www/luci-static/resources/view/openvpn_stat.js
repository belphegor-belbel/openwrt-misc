'use strict';
'require fs';
'require rpc';
'require ui';
'require validation';
'require view';
'require poll';

return view.extend({
  updateLists: function() {
    var statusDir = "/var/run";

    var tableClientList = document.getElementById("table_clientlist");
    if (tableClientList != null) {
      cbi_update_table(tableClientList, [], E('em', _('Refreshing...')));
    }

    fs.list(statusDir).then(
      (r) => {
        var rowsClientList = [];
        var rowsClientListUpdated = "";
        var promises = [];

        for (var i = 0; i < r.length; i++) {
          if ( (r[i].name.startsWith("openvpn.")) && (r[i].name.endsWith(".status")) ) {
            var instanceName = r[i].name.substring(8);
            instanceName = instanceName.substring(0, instanceName.indexOf(".status"));

            var promise = fs.lines(statusDir + "/" + r[i].name);
            promise.then(
              (clientListFile) => {
                var inList = 0;

                for (var j = 0; j < clientListFile.length; j++) {
                  if ((clientListFile[j] == "OpenVPN CLIENT LIST") && (j + 2 < clientListFile.length)) {
                    rowsClientListUpdated = clientListFile[j + 1].split(",")[1];

                    j += 2;
                    inList = 1;
                    continue;
                  } else if ((clientListFile[j] == "ROUTING TABLE") && (j + 1 < clientListFile.length)) {
                    j++;
                    inList = 2;
                  } else if ((clientListFile[j] == "GLOBAL STATS") && (j + 1 < clientListFile.length)) {
                    j++;
                    inList = 3;
                  }

                  if (inList == 1) {
                    // OpenVPN Client List
                    var clientData = clientListFile[j].split(",");
                    rowsClientList.push([ instanceName, ...clientData ]);
                  }
                }
              }
            );

            promises.push(promise);
          }
        }

        Promise.all(promises).then(
          (r) => {
            var lastUpdated = document.getElementById("lastupdated_clientlist");
            if (lastUpdated != null) {
              lastUpdated.innerHTML = rowsClientListUpdated;
            }

            cbi_update_table(document.getElementById("table_clientlist"),
              rowsClientList, E('em', _('Nothing found.')));
          });
      }
    );
  },

  render: function() {
    const v = E([], [
      E('h2', {}, [ _('OpenVPN connection status') ]),

      E('h3', {}, [ _('OpenVPN Client List') ]),
      E('div', { align: 'right' }, [
        E('label', {}, [ _("Last updated:") ]),
        E('div', { id: 'lastupdated_clientlist' }, []),
      ]),
      E('div', {}, [
        E('table', { class: 'table', id: 'table_clientlist' }, [
          E('tr', { class: 'tr table-titles' }, [
            E('th', { class: 'th' }, [ _('Instance') ]),
            E('th', { class: 'th' }, [ _('Common Name') ]),
            E('th', { class: 'th' }, [ _('Real Address') ]),
            E('th', { class: 'th' }, [ _('Bytes Received') ]),
            E('th', { class: 'th' }, [ _('Bytes Sent') ]),
            E('th', { class: 'th' }, [ _('Connected Since') ]),
          ]),
        ]),
      ]),
    ]);

    var THIS = this;

    this.updateLists();
    poll.add(function() { THIS.updateLists(); }, 60);
    poll.start();

    return v;
  },

  handleSaveApply: null,
  handleSave: null,
  handleReset: null,
});

