# openwrt-misc - luci-app-faxspooler
This is a FAX spooling service for LuCI.
This module uses ASTERISK to send FAX.

## Requirements
These packages are required to work.

* ghostscript (converts PDF -> TIFF)
* asterisk
* asterisk-app-system
* asterisk-chan-rtp
* asterisk-pbx-spool
* asterisk-pjsip
* asterisk-res-fax
* asterisk-res-fax-spandsp
* asterisk-res-pjproject
* asterisk-res-rtp-asterisk

In addition to the above, codec module (such as asterisk-codec-ulaw) is also required.

## Setup

It needs to be added a block like below to /etc/asterisk/pjsip.conf:

```
[gw]
type=aor
contact=sip:(USER)@(ADDR)

[gw]
type=auth
auth_type=userpass
username=(USER)
password=(PASSWORD)

[gw]
type=identify
endpoint=gw
match=(ADDR)

[gw]
type=endpoint
transport=(TRANSPORT)
dtmf_mode=inband
disallow=all
allow=(CODEC)
direct_media=no
send_pai=yes
inband_progress=yes
from_user=(USER)
from_domain=(ADDR)
outbound_auth=gw
aors=gw
fax_detect=yes
```

Where:
| name        | value |
| ----------- | ----- |
| (ADDR)      | IP address or host name for the SIP peer. |
| (USER)      | User name when accessing to the SIP peer. | 
| (PASSWORD)  | Password when accessing to the SIP peer. |
| (TRANSPORT) | Transport name (should exist as type=transport in pjsip.conf) |
| (CODEC)     | Codec name ("ulaw" or "alaw" etc.) |

It also needs to be added to /etc/asterisk/extensions.conf:

```
[faxsend]
exten = _X.,1,noop(Sending FAX spool...)
same = n,System(/bin/echo SENDING > ${FAXRESULTFILE})
same = n,SendFAX(${FAXFILE})
same = n,Hangup()

exten = h,1,Noop(Sending FAX complete)
same = n,Noop(Status: ${FAXSTATUS})
same = n,Noop(Error: ${FAXERROR})
same = n,System(/bin/echo ${FAXSTATUS} > ${FAXRESULTFILE})
same = n,Hangup()
```

Restarting or reloading is required after chaning the config file.

## Use

1. Log in to the LuCI web admin and access "Service" -> "FAX spooler".
1. Type destination and select PDF/TIFF file which you want to send.
1. Push "Upload" to spool.
1. This spool will be sent the next time you run the command "/usr/bin/faxspooler service". So you may want to run it regularly.
1. This LuCI web page will be reloaded regularly, so you can check the transmission result.

