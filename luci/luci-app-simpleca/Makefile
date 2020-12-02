#
# This is free software, licensed under the GPL License, Version 2.0.
#

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-simpleca
PKG_VERSION:=0.2
PKG_RELEASE:=0
PKG_MAINTAINER:=Yasuhiko Kamata <belphegor@belbel.or.jp>
PKG_LICENSE:=GPL-2.0

include $(INCLUDE_DIR)/package.mk

define Package/luci-app-simpleca
	SECTION:=luci
	CATEGORY:=LuCI
	SUBMENU:=3. Applications
	TITLE:=Simple CA module
	DEPENDS:=+luci-base +openssl-util +luci-compat
endef

define Package/luci-app-simpleca/description
	Simple CA management module for LuCI
endef

define Build/Compile
endef

define Package/luci-app-simpleca/install
	$(INSTALL_DIR) $(1)/usr/lib/lua/luci
	$(CP) ./luasrc/* $(1)/usr/lib/lua/luci
endef

$(eval $(call BuildPackage,luci-app-simpleca))

