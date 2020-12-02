m = Map("faxspooler", translate("FAX spooler"))
m.description = translate("FAX spooler can queue/send FAX spool. <br/> In order to send FAX spool, \"/usr/bin/faxspooler service\" should be run regularly (by cron for example) and set up asterisk accordingly.")

m:section(SimpleSection).template = "faxspooler"

return m

