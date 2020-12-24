m = Map("simple_ca", translate("OpenVPN connection status"))
m.description = translate("OpenVPN connection status")

m:section(SimpleSection).template = "openvpn_stat"

return m
