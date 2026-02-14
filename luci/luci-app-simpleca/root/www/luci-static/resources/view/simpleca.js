'use strict';
'require fs';
'require rpc';
'require ui';
'require validation';
'require view';

var SIMPLECA = '/usr/bin/simpleca';

function getDateTimeString() {
  var d = new Date();

  return (d.getFullYear()).toString().padStart(4, "0") +
    (d.getMonth() + 1).toString().padStart(2, "0") +
    (d.getDate()).toString().padStart(2, "0") +
    (d.getHours()).toString().padStart(2, "0") +
    (d.getMinutes()).toString().padStart(2, "0") +
    (d.getSeconds()).toString().padStart(2, "0");
}

function showBusy(target, busy) {
  if (target != null) {
    if (busy) {
      // show spinning
      var spinningTarget = this;
      target.className += " spinning";
    } else {
      // hide spinning
      target.className = target.className.replace(" spinning", "");
    }
  }
}

function createPkeyAndCsrForm(THIS, mode) {
  var title, finishButtonLabel;

  if (mode === 'util') {
    title = _('Create primary key and certificate signing request (CSR)');
    finishButtonLabel = _('Create primary key and certificate signing request (CSR)');
  } else if (mode === 'createca') {
    title = _('Create new certificate authority');
    finishButtonLabel = _('Create new certificate authority');
  } else {
    alert('Unknown mode!?');
    return;
  }

  fs.exec(SIMPLECA, [ 'util_listalgorithms' ]).then(
    (r) => {
      const result = JSON.parse(r.stdout);

      if ((r.code == 0) && (result.ok)) {
        var algorithms_result = [];

        var algorithms = Object.keys(result.algorithms);
        for (var i = 0; i < algorithms.length; i++) {
          algorithms_result[result.algorithms[algorithms[i]].order] = algorithms[i];
        }

        var algorithms_list = [];
        for (var i = 0; i < algorithms_result.length; i++) {
          algorithms_list.push(E('option', { value: algorithms_result[i] }, [ algorithms_result[i] ]));
        }

        var createca_list = [];
        if (mode === 'createca') {
          createca_list.push(
            E('div', {}, [ _('Certificate authority parameters') ]),

            E('table', { class: 'table' }, [
              E('tr', { class: 'tr cbi-rowstyle-1' }, [
                E('td', { class: 'td' }, [ _('CA name (only for reference)') ]),
                E('td', { class: 'td' }, [
                  E('input', { name: 'name' }),
                ]),
              ]),

              E('tr', { class: 'tr cbi-rowstyle-2' }, [
                E('td', { class: 'td' }, [ _('CA Validity period (days)') ]),
                E('td', { class: 'td' }, [
                  E('input', { name: 'days', type: 'number', value: '3650', min: '0' }),
                ]),
              ]),
            ]),
          );
        }

        ui.showModal(title, [
          E('div', { 'class': 'button-row' }, [
            ...createca_list,

            E('div', {}, [ _('Private key parameters') ]),

            E('table', { class: 'table' }, [
              E('tr', { class: 'tr cbi-rowstyle-1' }, [
                E('td', { class: 'td' }, [ _('Algorithm') ]),
                E('td', { class: 'td' }, [
                  E('select', { name: 'algorithm' }, [ ...algorithms_list ]),
                ]),
              ]),

              E('tr', { class: 'tr cbi-rowstyle-2' }, [
                E('td', { class: 'td' }, [ _('Password') ]),
                E('td', { class: 'td' }, [
                  E('input', { name: 'passwd', type: 'password' }),
                ]),
              ]),
            ]),

            E('div', {}, [ _('Certificate signing request (CSR) parameters') ]),

            E('table', { class: 'table' }, [
              E('tr', { class: 'tr cbi-rowstyle-1' }, [
                E('td', { class: 'td' }, [ _('Country Name (2 letter code)') ]),
                E('td', { class: 'td' }, [
                  E('input', { name: 'country', placeholder: 'XX' }),
                ]),
              ]),

              E('tr', { class: 'tr cbi-rowstyle-2' }, [
                E('td', { class: 'td' }, [ _('State or Province Name (full name)') ]),
                E('td', { class: 'td' }, [
                  E('input', { name: 'state', placeholder: 'Some-State' }),
                ]),
              ]),

              E('tr', { class: 'tr cbi-rowstyle-1' }, [
                E('td', { class: 'td' }, [ _('Locality name (city)') ]),
                E('td', { class: 'td' }, [
                  E('input', { name: 'localityname'  }),
                ]),
              ]),

              E('tr', { class: 'tr cbi-rowstyle-2' }, [
                E('td', { class: 'td' }, [ _('Organization name (company)') ]),
                E('td', { class: 'td' }, [
                  E('input', { name: 'orgname', placeholder: 'Internet Widgits Pty Ltd' }),
                ]),
              ]),

              E('tr', { class: 'tr cbi-rowstyle-1' }, [
                E('td', { class: 'td' }, [ _('Organizational unit name (section)') ]),
                E('td', { class: 'td' }, [
                  E('input', { name: 'orgunitname' }),
                ]),
              ]),

              E('tr', { class: 'tr cbi-rowstyle-2' }, [
                E('td', { class: 'td' }, [ _('Common name (server FQDN or YOUR name)') ]),
                E('td', { class: 'td' }, [
                  E('input', { name: 'commonname', placeholder: 'name.example.org'  }),
                ]),
              ]),

              E('tr', { class: 'tr cbi-rowstyle-2' }, [
                E('td', { class: 'td' }, [ _('Email Address') ]),
                E('td', { class: 'td' }, [
                  E('input', { name: 'email' }),
                ]),
              ]),
            ]),

            E('button', {
              'class': 'btn cbi-button-neutral',
              'click': ui.hideModal
            }, _('Cancel')),

            E('button', {
              'class': 'btn cbi-button-positive',
              'click': function(ev) {
                var caname = "";
                var days = "";
                var algorithm = "";
                var passwd = "";
                var country = "";
                var state = "";
                var localityname = "";
                var orgname = "";
                var orgunitname = "";
                var commonname = "";
                var email = "";

                findParent(ev.target, '.modal').querySelectorAll('select[name]').
                  forEach(function(select) {
                    var name = select.getAttribute('name');
                    if (name == 'algorithm') {
                      algorithm = select.value;
                    }
                  });

                findParent(ev.target, '.modal').querySelectorAll('input[name]').
                  forEach(function(input) {
                    var name = input.getAttribute('name');
                    if (name == 'name') {
                      caname = input.value;
                    } else if (name == 'days') {
                      days = input.value;
                    } else if (name == 'passwd') {
                      passwd = input.value;
                    } else if (name == 'country') {
                      country = input.value;
                    } else if (name == 'state') {
                      state = input.value;
                    } else if (name == 'localityname') {
                      localityname = input.value;
                    } else if (name == 'orgname') {
                      orgname = input.value;
                    } else if (name == 'orgunitname') {
                      orgunitname = input.value;
                    } else if (name == 'commonname') {
                      commonname = input.value;
                    } else if (name == 'email') {
                      email = input.value;
                    }
                  });

                var params = [];
                if (mode === 'util') {
                  params.push('util_create_pkeyandcsr');
                } else if (mode == 'createca') {
                  params.push('ca_create');

                  if (caname.length > 0) {
                    params.push('--name');
                    params.push(caname);
                  }
                  if (days.length > 0) {
                    params.push('--days');
                    params.push(days);
                  }
                }
                if (algorithm.length > 0) {
                  params.push('--algorithm');
                  params.push(algorithm);
                }
                if (passwd.length > 0) {
                  params.push('--passwd');
                  params.push(passwd);
                }
                if (country.length > 0) {
                  params.push('--country');
                  params.push(country);
                }
                if (state.length > 0) {
                  params.push('--state');
                  params.push(state);
                }
                if (localityname.length > 0) {
                  params.push('--localityname');
                  params.push(localityname);
                }
                if (orgname.length > 0) {
                  params.push('--orgname');
                  params.push(orgname);
                }
                if (orgunitname.length > 0) {
                  params.push('--orgunitname');
                  params.push(orgunitname);
                }
                if (commonname.length > 0) {
                  params.push('--commonname');
                  params.push(commonname);
                }
                if (email.length > 0) {
                  params.push('--email');
                  params.push(email);
                }

                // show busy
                showBusy(this, true);

                fs.exec(SIMPLECA, params).then(
                  (r) => {
                    // hide busy
                    showBusy(this, false);

                    const result = JSON.parse(r.stdout);
                    if ((r.code == 0) && (result.ok)) {
                      ui.hideModal();

                      if (mode === 'util') {
                        var a = document.createElement("a");
                        a.href = "data:application/x-gzip;base64," + result.arc
                        a.target = '_blank';
                        a.download = "pkeyandcsr-" + getDateTimeString() + ".tar.gz";
                        a.click();
                      } else if (mode === 'createca') {
                        THIS.updateCAList();
                      }
                    } else {
                      // error
                      alert(result.error);
                    }
                  }
                );
              }
            }, finishButtonLabel,
          )
        ]),
      ]);
    }
  });
}

return view.extend({
    load: function() {
        return Promise.all([
            L.resolveDefault(fs.exec(SIMPLECA), null)
        ]);
    },

    getCertificateOfCA: function(name) {
      fs.exec(SIMPLECA, [ 'ca_getcert', '--name', name ]).then(
        (r) => {
          const result = JSON.parse(r.stdout);

          if ((r.code == 0) && (result.ok)) {
            var a = document.createElement("a");
            a.href = "data:application/pkix-cert;base64," + result.cert
            a.target = '_blank';
            a.download = name + ".crt";
            a.click();
          } else {
            alert(result.error);
          }
        }
      );
    },

    backupCA: function(name) {
      fs.exec(SIMPLECA, [ 'ca_backup', '--name', name ]).then(
        (r) => {
          const result = JSON.parse(r.stdout);

          if ((r.code == 0) && (result.ok)) {
            var a = document.createElement("a");
            a.href = "data:application/x-gzip;base64," + result.backup
            a.target = '_blank';
            a.download = name + "-backup-" + getDateTimeString() + ".tar.gz";
            a.click();
          } else {
            // error
            alert(result.error);
          }
        }
      );
    },

    issueCrlCA: function(name) {
      ui.showModal(_('Issue CRL from CA %s').format(name), [
        E('div', { 'class': 'button-row' }, [
          E('table', { class: 'table' }, [
            E('tr', { class: 'tr cbi-rowstyle-1' }, [
              E('td', { class: 'td' }, [ _('CRL Validity period (days)') ]),
              E('td', { class: 'td' }, [
                E('input', { name: 'crldays', type: 'number', value: '30', min: '0' }),
              ]),
            ]),

            E('tr', { class: 'tr cbi-rowstyle-2' }, [
              E('td', { class: 'td' }, [ _('CA password') ]),
              E('td', { class: 'td' }, [
                E('input', { name: 'passwd', type: 'password' }),
              ]),
            ])
          ]),

          E('button', {
            'class': 'btn cbi-button-neutral',
            'click': ui.hideModal
          }, _('Cancel')),

          E('button', {
            'class': 'btn cbi-button-positive',
            'click': function(ev) {
              var crldays, passwd;

              findParent(ev.target, '.modal').querySelectorAll('input[name]').
                forEach(function(input) {
                  var name = input.getAttribute('name');
                  if (name == 'crldays') {
                    crldays = input.value;
                  } else if (name == 'passwd') {
                    passwd = input.value;
                  }
                });

              var params = [ 'ca_issuecrl', '--name', name, '--days', crldays ];
              if (passwd.length > 0) {
                params.push('--passwd');
                params.push(passwd);
              }
              fs.exec(SIMPLECA, params).then (
                (r) => {
                  ui.hideModal();

                  const result = JSON.parse(r.stdout);
                  if ((r.code == 0) && (result.ok)) {
                    var a = document.createElement("a");
                    a.href = "data:application/pkix-crl;base64," + result.crl
                    a.target = '_blank';
                    a.download = name + "-crl-" + getDateTimeString() + ".crl";
                    a.click();
                  } else {
                    // error
                    alert(result.error);
                  }
                }
              );
            }
          }, _('Issue CRL')),
        ]),
      ]);
    },

    changePasswdCA: function(name) {
      ui.showModal(_('Change Password of CA %s').format(name), [
        E('div', { 'class': 'button-row' }, [
          E('table', { class: 'table' }, [
            E('tr', { class: 'tr cbi-rowstyle-1' }, [
              E('td', { class: 'td' }, [ _('Old password') ]),
              E('td', { class: 'td' }, [
                E('input', { name: 'oldpasswd', type: 'password' }),
              ]),
            ]),

            E('tr', { class: 'tr cbi-rowstyle-2' }, [
              E('td', { class: 'td' }, [ _('New password') ]),
              E('td', { class: 'td' }, [
                E('input', { name: 'newpasswd1', type: 'password' }),
              ]),
            ]),

            E('tr', { class: 'tr cbi-rowstyle-1' }, [
              E('td', { class: 'td' }, [ _('New password (again)') ]),
              E('td', { class: 'td' }, [
                E('input', { name: 'newpasswd2', type: 'password' }),
              ]),
            ])
          ]),

          E('button', {
            'class': 'btn cbi-button-neutral',
            'click': ui.hideModal
          }, _('Cancel')),

          E('button', {
            'class': 'btn cbi-button-positive',
            'click': function(ev) {
              var oldpasswd, newpasswd1, newpasswd2;

              findParent(ev.target, '.modal').querySelectorAll('input[name]').
                forEach(function(input) {
                  var name = input.getAttribute('name');
                  if (name == 'oldpasswd') {
                    oldpasswd = input.value;
                  } else if (name == 'newpasswd1') {
                    newpasswd1 = input.value;
                  } else if (name == 'newpasswd2') {
                    newpasswd2 = input.value;
                  }
                });

              if (newpasswd1 !== newpasswd2) {
                alert('New password does not match!');
                return;
              }

              var params = [ 'ca_changepasswd', '--name', name ];
              if (oldpasswd.length > 0) {
                params.push('--oldpasswd');
                params.push(oldpasswd);
              }
              if (newpasswd1.length > 0) {
                params.push('--newpasswd');
                params.push(newpasswd1);
              }
              fs.exec(SIMPLECA, params).then (
                (r) => {
                  ui.hideModal();

                  const result = JSON.parse(r.stdout);
                  if ((r.code == 0) && (result.ok)) {
                    alert('OK');
                  } else {
                    // error
                    alert(result.error);
                  }
                }
              );
            }
          }, _('Change password')),
        ]),
      ]);
    },

    deleteCA: function(name) {
      var THIS = this;

      ui.showModal(_('Delete CA %s').format(name), [
        E('div', { 'class': 'button-row' }, [
          E('div', { }, [ _('Really delete CA "%s"? This action cannot be undone.').format(name) ]),

          E('button', {
            'class': 'btn cbi-button-neutral',
            'click': ui.hideModal
          }, _('Cancel')),

          E('button', {
            'class': 'btn cbi-button-positive',
            'click': function(ev) {
              var params = [ 'ca_delete', '--name', name ];
              fs.exec(SIMPLECA, params).then(
                (r) => {
                  ui.hideModal();

                  const result = JSON.parse(r.stdout);
                  if ((r.code == 0) && (result.ok)) {
                    THIS.updateCAList();
                  } else {
                    // error
                    alert(result.error);
                  }
                }
              );
            }
          }, _('Delete CA')),
        ]),
      ]);
    },

    updateCAList: function() {
      var tableCertificateAuthorities = document.getElementById("table_certificateauthorities");
      if (tableCertificateAuthorities != null) {
        cbi_update_table(tableCertificateAuthorities, [], E('em', _('Refreshing...')));
      }

      showBusy(tableCertificateAuthorities, true);

      fs.exec(SIMPLECA, [ 'ca_list' ]).then(
        (r) => {
          showBusy(tableCertificateAuthorities, false);

          const result = JSON.parse(r.stdout);

          if ((r.code == 0) && (result.ok)) {
            var rowsCAList = [];
            var selectCAList = document.getElementById("select_certificateauthorities");

            while (selectCAList.length > 0) {
              selectCAList.remove(0);
            }

            for (var i = 0; i < result.list.length; i++) {
              rowsCAList.push([
                result.list[i].name,
                new Date(result.list[i].created * 1000).toLocaleString(),
                new Date(result.list[i].expires * 1000).toLocaleString(),
                E('div', {}, [
                  E('button', {
                    'class': 'btn cbi-button-action',
                    'click': ui.createHandlerFn(this, "getCertificateOfCA", result.list[i].name)
                  }, _('Download CA certificate')),
                  E('button', {
                    'class': 'btn cbi-button-action important',
                    'click': ui.createHandlerFn(this, "backupCA", result.list[i].name)
                  }, _('Backup')),
                  E('button', {
                    'class': 'btn cbi-button-action',
                    'click': ui.createHandlerFn(this, "issueCrlCA", result.list[i].name)
                  }, _('Issue CRL')),
                  E('button', {
                    'class': 'btn cbi-button-action',
                    'click': ui.createHandlerFn(this, "changePasswdCA", result.list[i].name)
                  }, _('Change password')),
                  E('button', {
                    'class': 'btn cbi-button-negative',
                    'click': ui.createHandlerFn(this, "deleteCA", result.list[i].name)
                  }, _('Delete')),
                ])
              ]);

              selectCAList.add(E('option', {}, result.list[i].name));
            }

            // cannot use "tableCertificateAuthorities" because it may be null..
            cbi_update_table(document.getElementById("table_certificateauthorities"),
              rowsCAList, E('em', _('Nothing found.')));
            this.updateCertList();

            if (selectCAList.length < 1) {
              // "nothing"
            }
          } else {
            // error
            alert(result.error);
          }
        }
      );
    },

    refreshCA: function() {
      this.updateCAList();
    },

    createCA: function() {
      createPkeyAndCsrForm(this, 'createca');
    },

    checkImportCA: function(ev) {
      var backupTempFileName = '/tmp/cabackup.tar.gz';

      ui.uploadFile(backupTempFileName, ev.target).then(
        L.bind(function(btn, r) {
          return fs.exec(SIMPLECA, [ 'ca_checkrestore', '--backupfile', backupTempFileName ]);
        }, this, ev.target)).then(
          L.bind(function(btn, r) {
            const result = JSON.parse(r.stdout);

            if ((r.code == 0) && (result.ok)) {
              ui.showModal(_('Ready to import CA?'), [
                E('p', _('The uploaded backup archive seems to be valid. Press "Continue" to proceed restoring.')),

                E('div', { 'class': 'right' }, [
                  E('button', {
                    'class': 'btn',
                    'click': ui.createHandlerFn(this, function(ev) {
                      return fs.remove(backupTempFileName).finally(ui.hideModal);
                    }),
                  }, [ _('Cancel') ]),

                  E('button', {
                    'class': 'btn cbi-button-action important',
                    'click': ui.createHandlerFn(this, 'importCA', backupTempFileName)
                  }, [ _('Continue') ]),
                ]),
              ]);
            } else {
              // error
              alert(result.error);
            }
          }, this, ev.target)
        );
    },

    importCA: function(backupTempFileName, ev) {
      return fs.exec(SIMPLECA, [ 'ca_restore', '--backupfile', backupTempFileName ]).then(
        L.bind(function(btn, r) {
          const result = JSON.parse(r.stdout);

          if ((r.code == 0) && (result.ok)) {
            this.updateCAList();
          } else {
            // error
            alert(result.error);
          }

          return fs.remove(backupTempFileName).finally(ui.hideModal);
        }, this, ev.target
      ));
    },

    getCertificate: function(CAname, subject, serial) {
      fs.exec(SIMPLECA, [ 'cert_get', '--name', CAname, '--serial', serial ]).then(
        (r) => {
          const result = JSON.parse(r.stdout);

          if ((r.code == 0) && (result.ok)) {
            var a = document.createElement("a");
            a.href = "data:application/pkix-cert;base64," + result.crt
            a.target = '_blank';
            a.download = subject + ".crt";
            a.click();
          } else {
            // error
            alert(result.error);
          }
        }
      );
    },

    updateCertList: function() {
      var CAname = document.getElementById('select_certificateauthorities').value;

      var tableCertificates = document.getElementById("table_certificates");
      if (tableCertificates != null) {
        cbi_update_table(tableCertificates, [], E('em', _('Refreshing...')));
      }

      if (CAname.length < 1) {
        if (tableCertificates != null) {
          cbi_update_table(tableCertificates,
            [], E('em', _('Certificate authority is not selected or not exist.')));
        }

        return;
      }

      var checkboxValid = document.getElementById('checkbox_certlist_valid').checked;
      var checkboxExpired= document.getElementById('checkbox_certlist_expired').checked;
      var checkboxRevoked = document.getElementById('checkbox_certlist_revoked').checked;
      var checkboxUnknown = document.getElementById('checkbox_certlist_unknown').checked;

      var params = [];
      if (checkboxValid) {
        params.push("--showvalid");
        params.push("1");
      }
      if (checkboxExpired) {
        params.push("--showexpired");
        params.push("1");
      }
      if (checkboxRevoked) {
        params.push("--showrevoked");
        params.push("1");
      }
      if (checkboxUnknown) {
        params.push("--showunknown");
        params.push("1");
      }

      showBusy(tableCertificates, true);

      fs.exec(SIMPLECA, [ 'cert_list', '--name', CAname, ...params ]).then(
        (r) => {
          showBusy(tableCertificates, false);

          const result = JSON.parse(r.stdout);

          if ((r.code == 0) && (result.ok)) {
            var rowsCertList = [];

            for (var i = 0; i < result.list.length; i++) {
              rowsCertList.push([
                result.list[i].serial + "<br/>" + result.list[i].subject,
                _(result.list[i].status),
                new Date(result.list[i].created * 1000).toLocaleString(),
                new Date(result.list[i].expires * 1000).toLocaleString(),
                E('div', {}, [
                  E('button', {
                    'class': 'btn cbi-button-action',
                    'click': ui.createHandlerFn(this, "getCertificate", CAname, result.list[i].subject, result.list[i].serial)
                  }, _('Download certificate')),
                  E('button', {
                    'class': 'btn cbi-button-negative',
                    'click': ui.createHandlerFn(this, "revokeCert", CAname, result.list[i].subject, result.list[i].serial)
                  }, _('Revoke')),
                ])
              ]);
            }

            // cannot use "tableCertificates" because it may be null..
            cbi_update_table(document.getElementById("table_certificates"),
              rowsCertList, E('em', _('Nothing found.')));
          } else {
            // error
            alert(result.error);
          }
        }
      );
    },

    refreshCerts: function() {
      this.updateCertList();
    },

    issueCert: function(ev) {
      // TODO
      var csrTempFileName = '/tmp/certreq.csr';

      var CAname = document.getElementById('select_certificateauthorities').value;

      ui.uploadFile(csrTempFileName, ev.target).then(
        L.bind(function(btn, r) {
          return fs.exec(SIMPLECA, [ 'cert_checkcsr', '--csrfile', csrTempFileName ]);
        }, this, ev.target)).then(
          L.bind(function(btn, r) {
            const result = JSON.parse(r.stdout);

            if ((r.code == 0) && (result.ok)) {
              ui.showModal(_('Ready to issue certificate?'), [
                E('p', _('The uploaded CSR file seems to be valid. Press "Issue" to issue certificate.')),

                E('table', { class: 'table' }, [
                  E('tr', { class: 'tr cbi-rowstyle-1' }, [
                    E('td', { class: 'td' }, [ _('Certificate authority') ]),
                    E('td', { class: 'td' }, [ CAname ]),
                  ]),

                  E('tr', { class: 'tr cbi-rowstyle-1' }, [
                    E('td', { class: 'td' }, [ _('Subject') ]),
                    E('td', { class: 'td' }, [ result.subject ]),
                  ]),

                  E('tr', { class: 'tr cbi-rowstyle-2' }, [
                    E('td', { class: 'td' }, [ _('CA password') ]),
                    E('td', { class: 'td' }, [
                      E('input', { name: 'passwd', type: 'password' }),
                    ]),
                  ]),

                  E('tr', { class: 'tr cbi-rowstyle-1' }, [
                    E('td', { class: 'td' }, [ _('Validity period (days)') ]),
                    E('td', { class: 'td' }, [
                      E('input', { name: 'days', type: 'number', value: '365', min: '0' }),
                    ]),
                  ]),

                  E('tr', { class: 'tr cbi-rowstyle-1' }, [
                    E('td', { class: 'td' }, [ _('Usage') ]),
                    E('td', { class: 'td' }, [
                      E('input', { name: 'clientcert', type: 'checkbox', value: '1' }),
                      E('label', {}, [ _('Client certificate') ]),
                      E('label', {}, [ ' ' ]),

                      E('input', { name: 'servercert', type: 'checkbox', value: '1' }),
                      E('label', {}, [ _('Server certificate:') ]),
                    ]),
                  ])
                ]),

                E('div', { 'class': 'right' }, [
                  E('button', {
                    'class': 'btn',
                    'click': ui.createHandlerFn(this, function(ev) {
                      return fs.remove(csrTempFileName).finally(ui.hideModal);
                    }),
                  }, [ _('Cancel') ]),

                  E('button', {
                    'class': 'btn cbi-button-action important',
                    'click': function(ev) {
                      var passwd, days = 0, clientcert = 0, servercert = 0;

                      findParent(ev.target, '.modal').querySelectorAll('input[name]').
                        forEach(function(input) {
                          var name = input.getAttribute('name');
                          if (name == 'passwd') {
                            passwd = input.value;
                          } else if (name == 'days') {
                            days = input.value;
                          } else if (name == 'clientcert') {
                            if (input.checked) {
                              clientcert = 1;
                            }
                          } else if (name == 'servercert') {
                            if (input.checked) {
                              servercert = 1;
                            }
                          }
                        });

                      var params = [ 'cert_issue', '--name', CAname, '--days', days, '--csrfile', csrTempFileName ];
                      if (passwd.length > 0) {
                        params.push('--passwd');
                        params.push(passwd);
                      }
                      if (clientcert > 0) {
                        params.push('--clientcert');
                        params.push('1');
                      }
                      if (servercert > 0) {
                        params.push('--servercert');
                        params.push('1');
                      }
                      fs.exec(SIMPLECA, params).then(
                        (r) => {
                          const result2 = JSON.parse(r.stdout);
                          if ((r.code == 0) && (result2.ok)) {
                            fs.exec(SIMPLECA, [ 'cert_get', '--name', CAname, '--serial', result2.serial ]).then(
                              (r) => {
                                const result3 = JSON.parse(r.stdout);

                                if ((r.code == 0) && (result3.ok)) {
                                  var a = document.createElement("a");
                                  a.href = "data:application/pkix-cert;base64," + result3.crt
                                  a.target = '_blank';
                                  a.download = result.subject + ".crt";
                                  a.click();
                                } else {
                                  // error
                                  alert(result3.error);
                                }
                              }
                            );

                            fs.remove(csrTempFileName).finally(ui.hideModal);
                          } else {
                            // error
                            alert(result2.error);
                          }
                        }
                      );
                    }
                  }, [ _('Issue') ]),
                ]),
              ]);
            } else {
              // error
              alert(result.error);
            }
          }, this, ev.target)
        );
    },

    revokeCert: function(CAname, subject, serial) {
      var THIS = this;

      fs.exec(SIMPLECA, [ 'util_listrevocationreasons' ]).then(
        (r) => {
          const result = JSON.parse(r.stdout);

          if ((r.code == 0) && (result.ok)) {
            var reasons_result = [];

            var reasons = Object.keys(result.reasons);
            for (var i = 0; i < reasons.length; i++) {
              reasons_result[result.reasons[reasons[i]].order] = reasons[i];
            }

            var reasons_list = [];
            for (var i = 0; i < reasons_result.length; i++) {
              reasons_list.push(E('option', { value: reasons_result[i] }, [ reasons_result[i] ]));
            }

            ui.showModal(_('Revoke certificate'), [
              E('div', { 'class': 'button-row' }, [
                E('table', { class: 'table' }, [
                  E('tr', { class: 'tr cbi-rowstyle-1' }, [
                    E('td', { class: 'td' }, [ _('Certificate authority') ]),
                    E('td', { class: 'td' }, [ CAname ]),
                  ]),

                  E('tr', { class: 'tr cbi-rowstyle-2' }, [
                    E('td', { class: 'td' }, [ _('Subject') ]),
                    E('td', { class: 'td' }, [ subject ]),
                  ]),

                  E('tr', { class: 'tr cbi-rowstyle-1' }, [
                    E('td', { class: 'td' }, [ _('Serial') ]),
                    E('td', { class: 'td' }, [ serial ]),
                  ]),

                  E('tr', { class: 'tr cbi-rowstyle-2' }, [
                    E('td', { class: 'td' }, [ _('CA password') ]),
                    E('td', { class: 'td' }, [
                      E('input', { name: 'passwd', type: 'password' }),
                    ]),
                  ]),

                  E('tr', { class: 'tr cbi-rowstyle-1' }, [
                    E('td', { class: 'td' }, [ _('Revocation reason') ]),
                    E('td', { class: 'td' }, [
                      E('select', { name: 'reason' }, [ ...reasons_list ]),
                    ]),
                  ]),
                ]),

                E('button', {
                  'class': 'btn cbi-button-neutral',
                  'click': ui.hideModal
                }, _('Cancel')),

                E('button', {
                  'class': 'btn cbi-button-positive',
                  'click': function(ev) {
                    var passwd, reason;

                    findParent(ev.target, '.modal').querySelectorAll('select[name]').
                      forEach(function(select) {
                        var name = select.getAttribute('name');
                        if (name == 'reason') {
                          reason = select.value;
                        }
                      });

                    findParent(ev.target, '.modal').querySelectorAll('input[name]').
                      forEach(function(input) {
                        var name = input.getAttribute('name');
                        if (name == 'passwd') {
                          passwd = input.value;
                        }
                      });

                    var params = [ 'cert_revoke', '--name', CAname, '--serial', serial ];
                    if (passwd.length > 0) {
                      params.push('--passwd');
                      params.push(passwd);
                    }
                    if (reason.length > 0) {
                      params.push('--reason');
                      params.push(reason);
                    }
                    fs.exec(SIMPLECA, params).then (
                      (r) => {
                        ui.hideModal();

                        const result = JSON.parse(r.stdout);
                        if ((r.code == 0) && (result.ok)) {
                          alert('OK');
                          THIS.updateCertList();
                        } else {
                          // error
                          alert(result.error);
                        }
                      }
                    );
                  }
                }, _('Revoke certificate')),
              ]),
            ]);
          }
        });
    },

    utilCreatePkeyAndCsr: function() {
      createPkeyAndCsrForm(this, 'util');
    },

    render: function() {
      const v = E([], [
        E('h2', {}, [ _('Simple CA') ]),
        E('p', {}, [ _('Simple Certificate Authority (CA) application. You can create your own CAs and issue certificates from these CAs.') ]),
        E('div', {}, [
          E('div', { class: 'cbi-section', 'data-tab': 'certificateauthorities', 'data-tab-title': _('Certificate Authorities') }, [
            E('div', { class: 'button-row', align: 'right' }, [
              E('button', {
                class: 'btn cbi-button-positive',
                'click': ui.createHandlerFn(this, "refreshCA")
              }, _('Refresh CA list')),
              E('button', {
                class: 'btn cbi-button-positive',
                'click': ui.createHandlerFn(this, "createCA")
              }, _('Create new CA...')),
              E('button', {
                class: 'btn cbi-button-positive',
                'click': ui.createHandlerFn(this, "checkImportCA")
              }, _('Import from backup...')),
            ]),
            E('table', { class: 'table', id: 'table_certificateauthorities' }, [
              E('tr', { class: 'tr table-titles' }, [
                E('th', { class: 'th' }, [ _('Name') ]),
                E('th', { class: 'th' }, [ _('Created') ]),
                E('th', { class: 'th' }, [ _('Expires') ]),
                E('th', { class: 'th' }, [ _('Actions') ]),
              ])
            ]),
          ]),

          E('div', { class: 'cbi-section', 'data-tab': 'certificates', 'data-tab-title': _('Certificates') }, [
            E('div', { class: 'button-row', align: 'left' }, [
              E('label', {}, _('Select certificate authority:')),
              E('select', {
                name: 'certificateauthority',
                class: 'cbi-input-select',
                id: 'select_certificateauthorities',
                'change': ui.createHandlerFn(this, "refreshCerts")
              }),
              E('button', {
                class: 'btn cbi-button-positive',
                'click': ui.createHandlerFn(this, "refreshCA")
              }, _('Refresh CA list')),
            ]),
            E('div', { class: 'button-row', align: 'right' }, [
              E('button', {
                class: 'btn cbi-button-positive',
                'click': ui.createHandlerFn(this, "refreshCerts")
              }, _('Refresh certiticates list')),
              E('button', {
                class: 'btn cbi-button-positive',
                'click': ui.createHandlerFn(this, "issueCert")
              }, _('Issue certificate from CSR file...')),
            ]),
            E('div', { class: 'button-row', align: 'center' }, [
              E('input', {
                id: 'checkbox_certlist_valid',
                type: 'checkbox',
                value: '1',
                checked: '1',
                'click': ui.createHandlerFn(this, "refreshCerts")
              }),
              E('label', {}, [ _("Valid") ]),
              E('label', {}, [ ' ' ]),
              E('input', {
                id: 'checkbox_certlist_expired',
                type: 'checkbox',
                value: '1',
                'click': ui.createHandlerFn(this, "refreshCerts")
              }),
              E('label', {}, [ _("Expired") ]),
              E('label', {}, [ ' ' ]),
              E('input', {
                id: 'checkbox_certlist_revoked',
                type: 'checkbox',
                value: '1',
                'click': ui.createHandlerFn(this, "refreshCerts")
              }),
              E('label', {}, [ _("Revoked") ]),
              E('label', {}, [ ' ' ]),
              E('input', {
                id: 'checkbox_certlist_unknown',
                type: 'checkbox',
                value: '1',
                'click': ui.createHandlerFn(this, "refreshCerts")
              }),
              E('label', {}, [ _("Unknown") ]),
            ]),
            E('table', { class: 'table', id: 'table_certificates' }, [
              E('tr', { class: 'tr table-titles' }, [
                E('th', { class: 'th' }, [ _('Serial / Subject') ]),
                E('th', { class: 'th' }, [ _('Status') ]),
                E('th', { class: 'th' }, [ _('Created') ]),
                E('th', { class: 'th' }, [ _('Expires') ]),
                E('th', { class: 'th' }, [ _('Actions') ]),
              ])
            ]),
          ]),

          E('div', { class: 'cbi-section', 'data-tab': 'utils', 'data-tab-title': _('Utilities') }, [
            E('table', { class: 'table', id: 'table_utils' }, [
              E('tr', { class: 'tr table-titles' }, [
                E('th', { class: 'th' }, [ _('Name') ]),
                E('th', { class: 'th' }, [ _('Actions') ]),
              ]),

              E('tr', { class: 'tr cbi-rowstyle-1' }, [
                E('td', { class: 'td' }, [ _('Create primary key and certificate signing request (CSR)') ]),
                E('button', {
                  'class': 'btn cbi-button-action',
                  'click': ui.createHandlerFn(this, "utilCreatePkeyAndCsr")
                }, _('Create primary key and CSR')),
              ]),
            ]),
          ]),
        ])]);

      ui.tabs.initTabGroup(v.lastElementChild.childNodes);

      this.updateCAList();

      return v;
    },

    handleSaveApply: null,
    handleSave: null,
    handleReset: null
});
