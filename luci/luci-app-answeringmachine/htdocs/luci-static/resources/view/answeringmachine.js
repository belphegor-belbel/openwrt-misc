'use strict';
'require view';
'require fs';
'require ui';
'require uci';
'require form';
'require tools.widgets as widgets';

var CBIcheckPackages, CBIgenAstConf, CBIgetAstStatus, CBItestMail, CBItestNumber;

CBIcheckPackages = form.DummyValue.extend({
    renderWidget: function(section_id, option_id, cfgvalue) {
        return E([], [
            E('button', {
                'class': 'cbi-button cbi-button-apply',
                'click': ui.createHandlerFn(this, function() {
                      fs.exec('/usr/sbin/answeringmachine',
                        ['checkpackages']).then(
                          (r) => {
                            if (r.code == 0) {
                              if (r.stderr !== undefined) {
                                ui.addNotification(_('Package check result'), E('pre', r.stderr), 'warning');
                              } else {
                                ui.addNotification(_('Package check result'), E('pre', _('All required packages are installed.')), 'info');
                              }
                            } else {
                              ui.addNotification(_('Package check error'), E('pre', r.stdout + r.stderr), 'error');
                            }
                          });
                  }),
            }, _('Check packages'))
        ]);
    },
});

CBIgenAstConf = form.DummyValue.extend({
    renderWidget: function(section_id, option_id, cfgvalue) {
        return E([], [
            E('button', {
                'class': 'cbi-button cbi-button-apply',
                'click': ui.createHandlerFn(this, function() {
                      fs.exec('/usr/sbin/answeringmachine',
                        ['genastconf']).then(
                          (r) => {
                            if (r.code == 0) {
                              ui.addNotification(_('Updated asterisk configs.'), E('div', ''), 'info');
                            } else {
                              ui.addNotification(_('Update of asterisk configs failed.'), E('pre', r.stderr), 'error');
                            }
                          });
                  }),
            }, _('Update asterisk config'))
        ]);
    },
});

CBIgetAstStatus = form.DummyValue.extend({
    renderWidget: function(section_id, option_id, cfgvalue) {
        return E([], [
            E('pre', {}, cfgvalue)]);
    },
});

CBItestMail = form.DummyValue.extend({
    renderWidget: function(section_id, option_id, cfgvalue) {
        return E([], [
            E('button', {
                'class': 'cbi-button cbi-button-apply',
                'click': ui.createHandlerFn(this, function() {
                      fs.exec('/usr/sbin/answeringmachine',
                        ['sendmail', 'Test mail from answeringmachine',
                        'This is a test mail from answeringmachine.']).then(
                          (r) => {
                            if (r.code == 0) {
                              ui.addNotification(_('Test mail has been successfully sent.'), E('div', ''), 'info');
                            } else {
                              ui.addNotification(_('Test mail was failed to send.'), E('pre', r.stderr), 'error');
                            }
                          });
                  }),
            }, _('Send a test mail'))]);
    },
});

CBItestNumber = form.DummyValue.extend({
    renderWidget: function(section_id, option_id, cfgvalue) {
        return E([], [
            E('input', {
                'class': 'cbi-input-text',
                'id': 'number_list_test'
            }),
            E('button', {
                'class': 'cbi-button',
                'click': ui.createHandlerFn(this, function() {
                   var n = document.getElementById('number_list_test').value;

                    fs.exec('/usr/sbin/answeringmachine',
                      ['checkcaller', 'trusted', n, '1']).then(
                        (r_trusted) => {
                        fs.exec('/usr/sbin/answeringmachine',
                          ['checkcaller', 'blocked', n, '1']).then(
                            (r_blocked) => {
                            fs.exec('/usr/sbin/answeringmachine',
                              ['checkcaller', 'denied', n, '1']).then(
                                (r_denied) => {
                                  ui.addNotification('"' + n + '" matches:',
                                    E('pre',
                                      ((r_trusted.stdout !== undefined) ? r_trusted.stdout : '') +
                                      ((r_blocked.stdout !== undefined) ? r_blocked.stdout : '') +
                                      ((r_denied.stdout !== undefined) ? r_denied.stdout : '')),
                                    'info');
                              });
                          });
                      });
                })
            }, _('Test')),
            ]);
    },
});

return view.extend({
    load: function() {
        return Promise.all([
            L.resolveDefault(fs.exec('/usr/sbin/asterisk', ['-V']), null),
            L.resolveDefault(fs.exec('/usr/sbin/answeringmachine', ['getaststatus']), null),
        ]);
    },

    render: function(stats) {
        var m, s, o, v;
        v = '';
        m = new form.Map('answeringmachine', _('Answering Machine configurator for asterisk'));
        if (stats[0] && stats[0].code === 0) {
            v = stats[0].stdout.trim();
        }

        s = m.section(form.TypedSection, 'answeringmachine', v);
        s.anonymous = true;

        s.tab('setup', _('Setup'));

        s.taboption('setup', CBIcheckPackages, '_checkpackages', _('Check required packages'), _('Check whether required packages are installed or not.'));
        s.taboption('setup', form.Flag, 'reg_enabled', _('Use Registration'), _('Select whether to perform the registration against the SIP server.'));
        s.taboption('setup', form.Value, 'reg_sipserver', _('Registration SIP Server'), _('Specify the SIP server address for registration.'));
        s.taboption('setup', form.Value, 'reg_username', _('Registration User Name'), _('Specify the user name for registration.'));
        o = s.taboption('setup', form.Value, 'reg_password', _('Registration Password'), _('Specify the password for registration.'));
        o.password = true;
        o = s.taboption('setup', form.ListValue, 'use_codec', _('Codec'), _('Codec used during calls.'));
        o.value('ulaw', 'G.711 U-law');
        o.value('alaw', 'G.711 A-law');
        s.taboption('setup', CBIgenAstConf, '_genastconf', _('Update asterisk config'), _('Update /etc/asterisk/{pjsip,extensions}.conf. Push this button after saving configs.'));

        if (stats[1] && stats[1].code === 0) {
            v = stats[1].stdout.trim();
        }
        s.taboption('setup', CBIgetAstStatus, '_getaststatus', _('Registration status'), v);

        s.tab('notification', _('Notification'));
        s.taboption('notification', form.Flag, 'mail_smtpstarttls', _('Use StartTLS'), _('Use "STARTTLS" command while sending notifications.'));
        s.taboption('notification', form.Value, 'mail_smtpserver', _('Notification SMTP server'), _('Specify the mail (SMTP) server when sending notifications.'));
        s.taboption('notification', form.Value, 'mail_smtpport', _('Notification SMTP server port'), _('Specify the mail (SMTP) server port (usualy 25 or 587) when sending notifications.'));
        s.taboption('notification', form.Value, 'mail_from', _('Notification From Address'), _('Specify the source (From) address when sending notifications.'));
        s.taboption('notification', form.Value, 'mail_to', _('Notification To Address'), _('Specify the destination (To) address when sending notifications. Multiple addresses can be specified with comma-separated.'));
        s.taboption('notification', form.Value, 'mail_authuser', _('SMTP Authentication User'), _('Specify the SMTP authentication user name when sending notifications (optional).'));
        s.taboption('notification', form.Value, 'mail_authpass', _('SMTP Authentication Password'), _('Specify the SMTP authentication password when sending notifications (optional).')).password = true;
        s.taboption('notification', CBItestMail, '_testmail', _('Send test'), _('Push this button after saving configs.'));

        s.tab('general', _('General Settings'));

        s.taboption('general', form.Value, 'delay', _('Answer Delay [sec]'), _('Answer after the specified time has elapsed (default=60).'));
        o = s.taboption('general', form.Value, 'sleeptime', _('Sleeping Time (HH:MM-HH:MM)'), _('Answer immediately during these hours.'));
        o.placeholder = 'XX:XX-XX:XX';
        o.validate = function(i, v) {
          return (new RegExp('^[0-9]{1,2}:[0-9][0-9]-[0-9]{1,2}:[0-9][0-9]$')).test(v);
        };
        s.taboption('general', form.Value, 'playfile', _('Play File'), _('This file will be played before starting recording. Do not add extensions such as ".wav", ".ulaw", etc.'));
        s.taboption('general', form.Value, 'maxrecordtime', _('Maximum Recording Time [sec]'), _('Maximum recording time (default=60).'));

        s.tab('numberlist_trusted', _('Number List - Trusted'));

        o = s.taboption('numberlist_trusted', form.TextValue, '_numberlist_trusted', null,
          _('This is the list of trusted (does not go to answering machine regardless of sleeping time) caller numbers. Write one number per line. You can also use regular expression.'));
        o.rows = 20;
        o.cfgvalue = function(section_id) {
            return fs.trimmed('/etc/answeringmachine/numberlist_trusted');
        };
        o.write = function(section_id, formvalue) {
            return fs.write('/etc/answeringmachine/numberlist_trusted', formvalue.trim().replace(/\r\n/g, '\n') + '\n');
        };

        s.tab('numberlist_blocked', _('Number List - Blocked'));

        o = s.taboption('numberlist_blocked', form.TextValue, '_numberlist_blocked', null,
          _('This is the list of blocked (always go to answering machine immediately) caller numbers. Write one number per line. You can also use regular expression.'));
        o.rows = 20;
        o.cfgvalue = function(section_id) {
            return fs.trimmed('/etc/answeringmachine/numberlist_blocked');
        };
        o.write = function(section_id, formvalue) {
            return fs.write('/etc/answeringmachine/numberlist_blocked', formvalue.trim().replace(/\r\n/g, '\n') + '\n');
        };

        s.tab('numberlist_denied', _('Number List - Denied'));

        o = s.taboption('numberlist_denied', form.TextValue, '_numberlist_denied', null,
          _('This is the list of denied (always go to answering machine immediately, but recorded file will not be notified) caller numbers. Write one number per line. You can also use regular expression.'));
        o.rows = 20;
        o.cfgvalue = function(section_id) {
            return fs.trimmed('/etc/answeringmachine/numberlist_denied');
        };
        o.write = function(section_id, formvalue) {
            return fs.write('/etc/answeringmachine/numberlist_denied', formvalue.trim().replace(/\r\n/g, '\n') + '\n');
        };

        s.tab('numberlist_test', _('Number List - test'));
        o = s.taboption('numberlist_test', CBItestNumber, '_numberlist_test', _('Number Test'));

        return m.render();
    },
});
