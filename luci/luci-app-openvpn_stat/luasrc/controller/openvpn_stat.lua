module("luci.controller.openvpn_stat", package.seeall)

-- Requires: openssl-util, luci-compat, busybox
local uci = require "luci.model.uci"
local json = require "luci.jsonc"

function index()
  entry({"admin", "status", "openvpn_stat"}, cbi("openvpn_stat", {hideapplybtn=true, hideresetbtn=true, hidesavebtn=true}), _("OpenVPN connection status"))
  entry({"admin", "status", "openvpn_stat", "getstatus"}, call("get_status")).leaf = true
end

local openvpn_stat_pattern = "/var/run/openvpn.*.status"

function get_status()
  local e = {}

  local f = io.popen("find " .. openvpn_stat_pattern .. " -type f")
  if (f ~= nil) then
    for l in f:lines() do
      local g = io.open(l)
      if (g ~= nil) then
        local _, _, instance_name = l:find("openvpn%.(.*).status")
        local mode = -1

        local m = g:read("*line")
        while (m ~= nil) do
          if (m == "OpenVPN CLIENT LIST") then
            mode = 0

            -- last updated
            g:read("*line")
            -- header
            g:read("*line")
          elseif (m == "ROUTING TABLE") then
            mode = 1

            -- header
            g:read("*line")
          elseif (m == "GLOBAL STATS") then
            mode = 2
          elseif (m == "END") then
            mode = 3
          else
            if (mode == 0) then
              local dat = m:split(",")
              local r = {}

              local d = io.popen("date -D '%Y-%m-%d %H:%M:%S' -d '" ..
                dat[5] .. "' +'%s'")
              if (d ~= nil) then
                r.connected = d:read("*line")
                d:close()
              end

              r.instance = instance_name
              r.common_name = dat[1]
              r.real_address = dat[2]
              r.virtual_address = ""
              r.bytes_received = dat[3]
              r.bytes_sent = dat[4]

              e[r.instance .. "/" .. r.common_name] = r
            elseif (mode == 1) then
              local dat = m:split(",")
              local name = instance_name .. "/" .. dat[2]

              local d = io.popen("date -D '%Y-%m-%d %H:%M:%S' -d '" ..
                dat[4] .. "' +'%s'")
              if (d ~= nil) then
                e[name].last_ref = d:read("*line")
                d:close()
              end

              e[name].virtual_address = dat[1]
            end
          end

          m = g:read("*line")
        end

        g:close()
      end
    end

    f:close()
  end

  luci.http.write_json(e)
end
