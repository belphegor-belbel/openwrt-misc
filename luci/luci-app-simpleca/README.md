# openwrt-misc - luci-app-simpleca
This is a simple certificate authority service for LuCI.
You can create a certificate authority for local use.

## Requirements
These packages are required to work.

* openssl-util

## Use

1. Log in to the LuCI webadmin and access "Service" -> "Simple CA".
1. If you want to create a new CA:
   1. Push "Create New CA" and fill fields.
   1. Push "Create" to create.
1. If you want to issue a signed certificate:
   1. Select CA from "Select CA:" drop down box.
   1. Push "Browse" button and select CSR file.
   1. Fill fields and push "Create" to issue.

