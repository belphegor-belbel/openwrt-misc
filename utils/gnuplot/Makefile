include $(TOPDIR)/rules.mk

PKG_NAME:=gnuplot
PKG_VERSION:=5.4.0
PKG_RELEASE:=2

PKG_INSTALL=1

PKG_SOURCE:=$(PKG_NAME)-$(PKG_VERSION).tar.gz
PKG_SOURCE_URL:=@SF/gnuplot
PKG_MD5SUM:=ac586178f3b031dea82cd3890cefb21b

include $(INCLUDE_DIR)/package.mk

EXTRA_LDFLAGS += \
	-Wl,-rpath-link=$(STAGING_DIR)/usr/lib

CONFIGURE_VARS += \
	CPPFLAGS="$$$$CPPFLAGS -I$(STAGING_DIR)/usr/include/uClibc++" \
	CXXFLAGS="$$$$CXXFLAGS -fno-builtin -fno-rtti -nostdinc++" \
	LIBS="-nodefaultlibs -luClibc++ -lpthread -lgcc -lc"

define Package/gnuplot
  SECTION:=utils
  CATEGORY:=Utilities
  DEPENDS:=+libncurses +uclibcxx +zlib +libpng +libfreetype +libgd
  TITLE:=A portable command-line driven graphing utility
  URL:=http://sourceforge.net/projects/gnuplot/
endef

define Package/gnuplot/description
  Gnuplot  is a portable command-line driven graphing utility for linux, OS/2, 
  MS Windows, OSX, VMS, and many other platforms.
endef

CONFIGURE_ARGS += \
	--without-x \
	CC_FOR_BUILD=gcc \
	--disable-mouse \
	--without-tutorial \
	--without-row-help \
	--without-lisp-files \
	--without-lua

define Package/gnuplot/install
	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_BIN) $(PKG_INSTALL_DIR)/usr/bin/gnuplot $(1)/usr/bin/
endef

$(eval $(call BuildPackage,gnuplot))
