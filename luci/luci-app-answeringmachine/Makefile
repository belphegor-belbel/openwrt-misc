#
# This is free software, licensed under the GPL License, Version 3.0.
#

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-answeringmachine
PKG_VERSION:=0.4
PKG_RELEASE:=0
PKG_MAINTAINER:=Yasuhiko Kamata <belphegor@belbel.or.jp>
PKG_LICENSE:=GPL-3.0

include $(INCLUDE_DIR)/package.mk

define Package/luci-app-answeringmachine
	SECTION:=luci
	CATEGORY:=LuCI
	SUBMENU:=3. Applications
	TITLE:=LuCI Answering Machine configurator for asterisk
	DEPENDS:=+luci-base
endef

define Package/luci-app-answeringmachine/description
        LuCI Answering Machine configurator for asterisk.
endef

define Build/Compile
endef

define Package/luci-app-answeringmachine/install
	$(INSTALL_DIR) $(1)/www/luci-static/ $(1)/etc/config $(1)/etc/answeringmachine
	$(CP) ./root/* $(1)/
	$(CP) ./htdocs/* $(1)/www/
	$(CP) files/answeringmachine.config $(1)/etc/config/answeringmachine
	$(CP) files/numberlist_* $(1)/etc/answeringmachine
endef

define Package/luci-app-answeringmachine/conffiles
/etc/config/answeringmachine
/etc/answeringmachine/
endef

$(eval $(call BuildPackage,luci-app-answeringmachine))

