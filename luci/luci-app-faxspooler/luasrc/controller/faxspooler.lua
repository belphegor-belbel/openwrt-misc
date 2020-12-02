module("luci.controller.faxspooler", package.seeall)

function index()
  entry({"admin", "services", "faxspooler"}, cbi("faxspooler", {hideapplybtn=true, hideresetbtn=true, hidesavebtn=true}), _("FAX spooler"))
  entry({"admin", "services", "faxspooler", "manage", }, cbi("faxspooler")).dependent = false
  entry({"admin", "services", "faxspooler", "manage", "listspool"}, call("list_spool")).leaf = true
  entry({"admin", "services", "faxspooler", "manage", "addspool"}, call("add_spool"))
  entry({"admin", "services", "faxspooler", "manage", "delspool"}, call("del_spool"))
  entry({"admin", "services", "faxspooler", "manage", "viewspool"}, call("view_spool"))
end

local json = require "luci.jsonc"

local faxspooler = "/usr/bin/faxspooler"

function list_spool()
  luci.http.status(200, "OK")
  luci.http.prepare_content("application/json")

  f = io.popen(faxspooler .. " listspool")
  if (f == nil) then
    luci.http.write_json({ Error="unable to list spool" })
  end

  for line in f:lines() do
    luci.http.write(line)
  end

  f:close()
end

function add_spool()
  local f
  local tmpfile = os.tmpname()
  local exten = string.gsub(luci.http.formvalue("extension"), "[^A-Za-z0-9_]", "")
  local upload = luci.http.formvalue("spool_file");

  os.remove(tmpfile)

  luci.http.setfilehandler(
    function(meta, chunk, eof)
      if not f and meta and meta.name == "spool_file" then
        f = io.open(tmpfile, "w")
        if (f == nil) then
          luci.http.write_json({ error="Unable to write temporary file" })
          return
        end
      end

      if f and chunk then
        f:write(chunk)
      end

      if f and eof then
        f:close()
        f = nil
      end
    end
  )

  if f then
    f:close()
  end

  f = io.popen(faxspooler .. " addspool " .. exten .. " " .. tmpfile)
  if (f == nil) then
    os.remove(tmpfile)
    luci.http.write_json({ error="faxspooler addspool failed." })
    return
  end

  local result = ""
  while f do
    data = f:read(1024)
    eof = (not data or data == "")

    if (eof) then
      f:close()
      f = nil
    else
      result = result .. data
    end
  end

  os.remove(tmpfile)

  if string.len(result) > 0 then
    luci.http.write(result);
  end
end

function view_spool()
  local view_id = string.gsub(luci.http.formvalue("view_id"), "[^A-Za-z0-9_]", "")

  local reader = ltn12_popen(faxspooler .. " viewspool " .. view_id)
  luci.http.prepare_content("application/pdf")
  luci.ltn12.pump.all(reader, luci.http.write)

end

-- Copied from luci/modules/luci-mod-admin-mini/luasrc/controller/mini/system.lua
function ltn12_popen(command)
  local fdi, fdo = nixio.pipe()
  local pid = nixio.fork()

  if pid > 0 then
    fdo:close()
    local close
    return function()
      local buffer = fdi:read(2048)
      local wpid, stat = nixio.waitpid(pid, "nohang")
      if not close and wpid and stat == "exited" then
        close = true
      end

      if buffer and #buffer > 0 then
        return buffer
      elseif close then
        fdi:close()
        return nil
      end
    end
  elseif pid == 0 then
    nixio.dup(fdo, nixio.stdout)
    fdi:close()
    fdo:close()
    nixio.exec("/bin/sh", "-c", command)
  end
end

function del_spool()
  local cancel_id = string.gsub(luci.http.formvalue("cancel_id"), "[^A-Za-z0-9_]", "")

  f = io.popen(faxspooler .. " delspool " .. cancel_id)
  if (f == nil) then
    luci.http.status(404, "Error: unable to find spool")
    os.remove(tmpfile)

    luci.http.prepare_content("text/html")
    luci.http.write("<html><body><div>Error: unable to find spool. <a href=\"../\">Return</a></div></body></html>")
    return
  end

  f:close()
end
