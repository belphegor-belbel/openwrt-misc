# openwrt-misc
Other miscellaneous packages for OpenWrt.

## How to use
These packages can be used via [feeds.conf](https://openwrt.org/docs/guide-developer/feeds).

(assuming that OpenWrt itself has already been configured and built)
1. Edit `feeds.conf` and add a line as follows:  
```src-git misc https://github.com/belphegor-belbel/openwrt-misc.git```
1. Run `scripts/feeds update -a` to update (fetch) source codes.
1. Run `scripts/feeds install -d -m (name)` to install package  
(where `(name)` is a package name such as "luci-app-simpleca").
1. Run `make` to build packages.
1. When completed without any problems, packages should be exist under `bin/(arch)/packages/misc/`  
(where `(arch)` is an architecture name such as "aarch64_cortex-a53").
