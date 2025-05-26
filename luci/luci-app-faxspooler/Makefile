#
# This is free software, licensed under the GPL License, Version 2.0.
#

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-faxspooler
PKG_VERSION:=0.7
PKG_RELEASE:=0
PKG_MAINTAINER:=Yasuhiko Kamata <belphegor@belbel.or.jp>
PKG_LICENSE:=GPL-2.0

include $(INCLUDE_DIR)/package.mk

define Package/luci-app-faxspooler
	SECTION:=luci
	CATEGORY:=LuCI
	SUBMENU:=3. Applications
	TITLE:=FAX spooler module
	DEPENDS:=+luci-base +ghostscript +tiff-utils +luci-compat
endef

define Package/luci-app-faxspooler/description
	FAX spooler module for asterisk.
	It requires asterisk16 (or later) and asterisk16-pbx-spool (or later) module.
endef

define Build/Compile
endef

define Package/luci-app-faxspooler/install
	$(INSTALL_DIR) $(1)/usr/lib/lua/luci
	$(CP) ./luasrc/* $(1)/usr/lib/lua/luci
	$(CP) ./root/* $(1)/
endef

$(eval $(call BuildPackage,luci-app-faxspooler))

