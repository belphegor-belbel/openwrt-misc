m = Map("simple_ca", translate("Simple CA manager"))
m.description = translate("Simple CA manager.")

m:section(SimpleSection).template = "simple_ca"

return m
