module("luci.controller.simple_ca", package.seeall)

-- Requires: openssl-util, luci-compat, busybox
local uci = require "luci.model.uci"
local json = require "luci.jsonc"

function index()
  entry({"admin", "services", "simple_ca"}, cbi("simple_ca", {hideapplybtn=true, hideresetbtn=true, hidesavebtn=true}), _("Simple CA"))
  entry({"admin", "services", "simple_ca", "ca_create"}, call("ca_create")).leaf = true
  entry({"admin", "services", "simple_ca", "ca_delete"}, call("ca_delete"))
  entry({"admin", "services", "simple_ca", "ca_list"}, call("ca_list"))
  entry({"admin", "services", "simple_ca", "ca_downloadcert"}, call("ca_downloadcert"))
  entry({"admin", "services", "simple_ca", "ca_backup"}, call("ca_backup"))
  entry({"admin", "services", "simple_ca", "ca_issuecrl"}, call("ca_issuecrl"))
  entry({"admin", "services", "simple_ca", "ca_changepassword"}, call("ca_changepassword"))
  entry({"admin", "services", "simple_ca", "ca_checkrestore"}, call("ca_checkrestore"))
  entry({"admin", "services", "simple_ca", "ca_restore"}, call("ca_restore"))
  entry({"admin", "services", "simple_ca", "cert_list"}, call("cert_list"))
  entry({"admin", "services", "simple_ca", "cert_check_csr"}, call("cert_check_csr"))
  entry({"admin", "services", "simple_ca", "cert_issue"}, call("cert_issue"))
  entry({"admin", "services", "simple_ca", "cert_downloadcert"}, call("cert_downloadcert"))
  entry({"admin", "services", "simple_ca", "cert_revoke"}, call("cert_revoke"))
  entry({"admin", "services", "simple_ca", "util_create_key_csr"}, call("create_key_csr"))
end

local ca_rootdir = "/etc/simple_ca"

local LOGGER = "/usr/bin/logger"
local MKDIR = "/bin/mkdir"
local TOUCH = "/bin/touch"
local SED = "/bin/sed"
local TAR = "/bin/tar"
local RM = "/bin/rm"
local MV = "/bin/mv"
local CAT = "/bin/cat"
local FIND = "/usr/bin/find"
local TR = "/usr/bin/tr"
local BASENAME = "/usr/bin/basename"
local OPENSSL = "/usr/bin/openssl"

function create_temp_opensslcnf(ca_dir)
  local tempCnf = os.tmpname()

  local f = io.open(tempCnf, "w")
  f:write("[ ca ]\n")
  f:write("default_ca=defaultCA\n")
  f:write("\n")
  f:write("[ defaultCA ]\n")
  f:write("dir=" .. ca_dir .. "\n")
  f:write("\n")
  f:write("certs=$dir/certs\n")
  f:write("crl_dir=$dir/crl\n")
  f:write("database=$dir/index.txt\n")
  f:write("#unique_subject=no\n")
  f:write("new_certs_dir=$dir/newcerts\n")
  f:write("certificate=$dir/cacert.pem\n")
  f:write("serial=$dir/serial\n")
  f:write("crlnumber=$dir/crlnumber\n")
  f:write("crl=$dir/crl.pem\n")
  f:write("private_key=$dir/private/cakey.pem\n")
  f:write("default_md=default\n")
  f:write("policy=policy_anything\n")
  f:write("default_days=365\n")
  f:write("\n")
  f:write("[ v3_ca ]\n")
  f:write("subjectKeyIdentifier=hash\n")
  f:write("authorityKeyIdentifier=keyid:always,issuer\n")
  f:write("basicConstraints = critical,CA:true\n")
  f:write("\n")
  f:write("[ client_cert ]\n")
  f:write("keyUsage = nonRepudiation, digitalSignature, keyEncipherment\n")
  f:write("extendedKeyUsage = clientAuth\n")
  f:write("\n")
  f:write("[ server_cert ]\n")
  f:write("keyUsage = nonRepudiation, digitalSignature, keyEncipherment\n")
  f:write("extendedKeyUsage = serverAuth\n")
  f:write("\n")
  f:write("[ both_cert ]\n")
  f:write("keyUsage = nonRepudiation, digitalSignature, keyEncipherment\n")
  f:write("extendedKeyUsage = clientAuth, serverAuth\n")
  f:write("\n")
  f:write("[ policy_anything ]\n")
  f:write("countryName=optional\n")
  f:write("stateOrProvinceName=optional\n")
  f:write("localityName=optional\n")
  f:write("organizationName=optional\n")
  f:write("organizationalUnitName=optional\n")
  f:write("commonName=supplied\n")
  f:write("emailAddress=optional\n")

  f:close()
  return tempCnf
end

function filterIllegalChars(src)
  return string.gsub(src, "[^A-Za-z0-9@%-%_%. ]", "")
end

function fork_popen(command)
  local fdi, fdo = nixio.pipe()
  local pid = nixio.fork()

  if pid > 0 then
    fdo:close()
    local close

    return function()
      local buffer = fdi:read(2048)
      local wpid, stat = nixio.waitpid(pid, "nohang")
      if not close and wpid and stat == "exited" then
        close = true
      end

      if buffer and #buffer > 0 then
        return buffer
      elseif close then
        fdi:close()
        return nil
      end
    end
  elseif pid == 0 then
    nixio.dup(fdo, nixio.stdout)
    fdi:close()
    fdo:close()
    nixio.exec("/bin/sh", "-c", command)
  end
end

function genPkeyAndCsr(destKeyFile, destCsrFile)
  local pkeyparam = filterIllegalChars(luci.http.formvalue("pkeyparam"))
  local pkeypass = luci.http.formvalue("pkeypass")
  local country = filterIllegalChars(luci.http.formvalue("country"))
  local state = filterIllegalChars(luci.http.formvalue("state"))
  local locality = filterIllegalChars(luci.http.formvalue("locality"))
  local organization = filterIllegalChars(luci.http.formvalue("organization"))
  local unit = filterIllegalChars(luci.http.formvalue("unit"))
  local commonname = filterIllegalChars(luci.http.formvalue("commonname"))
  local email = filterIllegalChars(luci.http.formvalue("email"))

  -- create password file
  local passfile = os.tmpname()
  local f = io.open(passfile, "w")
  if (f == nil) then
    os.remove(passfile)
    luci.http.write_json({ error="Unable to create password file" })
    return 1
  end

  f:write(pkeypass)
  f:close()

  -- Generate private key
  local opensslparams = ""
  if (pkeyparam == "rsa2048") then
    opensslparams = "-algorithm rsa -pkeyopt rsa_keygen_bits:2048"
  elseif (pkeyparam == "rsa4096") then
    opensslparams = "-algorithm rsa -pkeyopt rsa_keygen_bits:4096"
  elseif (pkeyparam == "rsa8192") then
    opensslparams = "-algorithm rsa -pkeyopt rsa_keygen_bits:8192"
  elseif (pkeyparam == "rsa16384") then
    opensslparams = "-algorithm rsa -pkeyopt rsa_keygen_bits:16384"
  elseif (pkeyparam == "ec_secp521r1") then
    opensslparams = "-algorithm EC -pkeyopt ec_paramgen_curve:secp521r1 -pkeyopt ec_param_enc:named_curve"
  elseif (pkeyparam == "ec_prime256v1") then
    opensslparams = "-algorithm EC -pkeyopt ec_paramgen_curve:prime256v1 -pkeyopt ec_param_enc:named_curve"
  elseif (pkeyparam == "ec_wap-wsg-idm-ecid-wtls12") then
    opensslparams = "-algorithm EC -pkeyopt ec_paramgen_curve:wap-wsg-idm-ecid-wtls12 -pkeyopt ec_param_enc:named_curve"
  elseif (pkeyparam == "ec_brainpoolP512t1") then
    opensslparams = "-algorithm EC -pkeyopt ec_paramgen_curve:brainpoolP512t1 -pkeyopt ec_param_enc:named_curve"
  elseif (pkeyparam == "ec_sm2") then
    opensslparams = "-algorithm EC -pkeyopt ec_paramgen_curve:SM2 -pkeyopt ec_param_enc:named_curve"
  elseif (pkeyparam == "ed25519") then
    opensslparams = "-algorithm ED25519"
  else
    os.remove(passfile)
    luci.http.write_json({ error="Unknown private key parameter [" .. pkeyparam .. "]" })
    return 1
  end
  if (pkeypass:len() > 0) then
    if (os.execute(OPENSSL .. " genpkey " .. opensslparams .. " -aes256 " ..
      "-pass file:" .. passfile .. " -out " .. destKeyFile .. " > /dev/null") ~= 0) then
      os.remove(passfile)
      luci.http.write_json({ error="Unable to generate private key (with password)" })
      return 1
    end
  else
    if (os.execute(OPENSSL .. " genpkey " .. opensslparams ..
      " -out " .. destKeyFile .. " > /dev/null") ~= 0) then
      os.remove(passfile)
      luci.http.write_json({ error="Unable to generate private key (without password)" })
      return 1
    end
  end

  -- Generate CSR
  local subj = ""
  if country and (#country > 0) then
    subj = subj .. "/C=" .. country
  end
  if state and (#state > 0) then
    subj = subj .. "/ST=" .. state
  end
  if locality and (#locality > 0) then
    subj = subj .. "/L=" .. locality
  end
  if organization and (#organization > 0) then
    subj = subj .. "/O=" .. organization
  end
  if unit and (#unit > 0) then
    subj = subj .. "/OU=" .. unit
  end
  if commonname and (#commonname > 0) then
    subj = subj .. "/CN=" .. commonname
  end
  if email and (#email > 0) then
    subj = subj .. "/emailAddress=" .. email
  end
  if (pkeypass:len() > 0) then
    if (os.execute(OPENSSL .. " req -new -batch -subj \"" .. subj .. "\" -key " ..
      destKeyFile .. " -passin file:" .. passfile .. " -out " .. destCsrFile .. " > /dev/null") ~= 0) then
      os.remove(passfile)
      luci.http.write_json({ error="Unable to generate certificate request (with password)" })
      return 1
    end
  else
    if (os.execute(OPENSSL .. " req -new -batch -subj \"" .. subj .. "\" -key " ..
      destKeyFile .. " -out " .. destCsrFile .. " > /dev/null") ~= 0) then
      os.remove(passfile)
      luci.http.write_json({ error="Unable to generate certificate request (without password)" })
      return 1
    end
  end

  os.remove(passfile)

  return 0
end

function ca_create()
  local ca_name = string.gsub(luci.http.formvalue("ca_name"), "[^A-Za-z0-9_]", "")
  local pkeypass = luci.http.formvalue("pkeypass")
  local ca_valid_days = tonumber(luci.http.formvalue("ca_valid_days"))

  os.execute(LOGGER .. " 'Creating new CA [" .. ca_name .. "]'")

  -- Create CA directory structure
  os.execute(MKDIR .. " -p " .. ca_rootdir)
  if (os.execute(MKDIR .. " " .. ca_rootdir .. "/" .. ca_name) ~= 0) then
    luci.http.write_json({ error="Unable to create CA directory" })
    return
  end
  if (os.execute(MKDIR .. " " .. ca_rootdir .. "/" .. ca_name .. "/private") ~= 0) then
    luci.http.write_json({ error="Unable to create CA private directory" })
    return
  end
  if (os.execute(MKDIR .. " " .. ca_rootdir .. "/" .. ca_name .. "/certs") ~= 0) then
    luci.http.write_json({ error="Unable to create CA certs directory" })
    return
  end
  if (os.execute(MKDIR .. " " .. ca_rootdir .. "/" .. ca_name .. "/crl") ~= 0) then
    luci.http.write_json({ error="Unable to create CA CRL directory" })
    return
  end
  if (os.execute(MKDIR .. " " .. ca_rootdir .. "/" .. ca_name .. "/newcerts") ~= 0) then
    luci.http.write_json({ error="Unable to create CA newcerts directory" })
    return
  end
  if (os.execute(TOUCH .. " " .. ca_rootdir .. "/" .. ca_name .. "/index.txt") ~= 0) then
    luci.http.write_json({ error="Unable to create CA index file" })
    return
  end
  if (os.execute("echo 00 > " .. ca_rootdir .. "/" .. ca_name .. "/crlnumber") ~= 0) then
    luci.http.write_json({ error="Unable to create CA CRL number file" })
    return
  end

  if (genPkeyAndCsr(ca_rootdir .. "/" .. ca_name .. "/private/cakey.pem",
    ca_rootdir .. "/" .. ca_name .. "/careq.pem") ~= 0) then
    luci.http.write_json({ error="Unable to generate CA private key or CSR" })
    return
  end

  -- create password file
  local passfile = os.tmpname()
  local f = io.open(passfile, "w")
  if (f == nil) then
    os.remove(passfile)
    luci.http.write_json({ error="Unable to create password file" })
    return 1
  end

  f:write(pkeypass)
  f:close()

  -- Generate certificate
  local sslCnf = create_temp_opensslcnf(ca_rootdir .. "/" .. ca_name .. "/")
  if (os.execute(OPENSSL .. " ca -config " .. sslCnf .. " -create_serial " ..
    "-passin file:" .. passfile .. " -out " .. ca_rootdir .. "/" .. ca_name ..
    "/cacert.pem -days " .. ca_valid_days .. " -batch -keyfile " ..
    ca_rootdir .. "/" .. ca_name .. "/private/cakey.pem -selfsign " ..
    "-extensions v3_ca -in " .. ca_rootdir .. "/" .. ca_name .. "/careq.pem > /dev/null")
    ~= 0) then
    os.remove(passfile)
    os.remove(sslCnf)
    luci.http.write_json({ error="Unable to generate CA certificate" })
  end

  os.remove(passfile)
  os.remove(sslCnf)
  os.execute(LOGGER .. " 'Created new CA [" .. ca_name .. "]'")

  luci.http.write_json({ ok="Created new CA [" .. ca_name .. "]" })
end

function ca_list()
  luci.http.status(200, "OK")
  luci.http.prepare_content("application/json")

  f = io.popen(FIND .. " " .. ca_rootdir .. " -type d -maxdepth 1")
  if (f == nil) then
    luci.http.write_json({ error="unable to list CA" })
  end

  local e={}
  for line in f:lines() do
    f2 = io.open(line .. "/private/cakey.pem")
    if (f2 ~= nil) then
      f2:close()

      local r={}

      d = io.popen(BASENAME .. " " .. " " .. line)
      if (d ~= nil) then
        r.name = tostring(d:read())
        d:close()
      end

      d = io.popen("date -d \"`" .. OPENSSL .. " x509 -in " .. line ..
        "/cacert.pem -noout -startdate | " .. SED .. " s/^.*=//`\"" ..
        " -D \"%b %d %H:%M:%S %Y\" -u +\"%s\"")
      if (d ~= nil) then
        r.created = tonumber(d:read())
        d:close()
      end

      d = io.popen("date -d \"`" .. OPENSSL .. " x509 -in " .. line ..
        "/cacert.pem -noout -enddate | " .. SED .. " s/^.*=//`\"" ..
        " -D \"%b %d %H:%M:%S %Y\" -u +\"%s\"")
      if (d ~= nil) then
        r.expires = tonumber(d:read())
        d:close()
      end

      e[ #e + 1 ] = r
    end
  end

  luci.http.write_json(e)

  f:close()
end

function ca_downloadcert()
  local ca_name = string.gsub(luci.http.formvalue("ca_name"), "[^A-Za-z0-9_]", "")

  local cacert_pem = ca_rootdir .. "/" .. ca_name .. "/cacert.pem"
  f = io.open(cacert_pem)
  if (f == nil) then
    luci.http.write_json({ error="Unable to find CA " .. ca_name })
    return
  end

  f:close()

  os.execute(LOGGER .. " 'Downloading certificate of CA [" .. ca_name .. "]'")

  local reader = fork_popen(CAT .. " " .. ca_rootdir .. "/" .. ca_name ..
    "/cacert.pem")

  local filename = ca_name .. '.crt'
  luci.http.header('Content-Disposition', 'attachment; ' ..
    'filename="' .. filename .. '"')
  luci.http.header('X-FileName', filename)
  luci.http.prepare_content("application/x-x509-ca-cert")
  luci.ltn12.pump.all(reader, luci.http.write)
end

function ca_backup()
  local ca_name = string.gsub(luci.http.formvalue("ca_name"), "[^A-Za-z0-9_]", "")

  local cacert_pem = ca_rootdir .. "/" .. ca_name .. "/cacert.pem"
  f = io.open(cacert_pem)
  if (f == nil) then
    luci.http.write_json({ error= "Unable to find CA " .. ca_name })
    return
  end

  f:close()

  os.execute(LOGGER .. " 'Backing up CA [" .. ca_name .. "]'")

  local reader = fork_popen(TAR .. " czC " .. ca_rootdir .. " " .. ca_name)

  local filename = ca_name .. '.backup.%s.tar.gz' % { os.date("%Y%m%d_%H%M%S") }
  luci.http.header('Content-Disposition', 'attachment; ' ..
    'filename="' .. filename .. '"' )
  luci.http.header('X-FileName', filename)
  luci.http.prepare_content("application/x-compressed-tar")
  luci.ltn12.pump.all(reader, luci.http.write)
end

function ca_delete()
  local ca_name = string.gsub(luci.http.formvalue("ca_name"), "[^A-Za-z0-9_]", "")

  os.execute(LOGGER .. " 'Removing CA [" .. ca_name .. "]'");
  if (os.execute(RM .. " -fR " .. ca_rootdir .. "/" .. ca_name) ~= 0) then
    luci.http.write_json({ error="Unable to delete CA " .. ca_name })
  end

  os.execute(LOGGER .. " 'Removed CA [" .. ca_name .. "]'");
  luci.http.write_json({ ok="Removed CA [" .. ca_name .. "]" })
end

function ca_issuecrl()
  local ca_name = string.gsub(luci.http.formvalue("ca_name"), "[^A-Za-z0-9_]", "")
  local pkeypass = luci.http.formvalue("pkeypass")
  local crl_valid_days = string.gsub(luci.http.formvalue("crl_valid_days"), "[^0-9]", "")

  -- create password file
  local passfile = os.tmpname()
  local f = io.open(passfile, "w")
  if (f == nil) then
    os.remove(passfile)
    luci.http.write_json({ error="Unable to create password file" })
    return 1
  end

  f:write(pkeypass)
  f:close()

  -- Issue CRL
  local tmpCrl = os.tmpname()
  local sslCnf = create_temp_opensslcnf(ca_rootdir .. "/" .. ca_name .. "/")
  if (os.execute(OPENSSL .. " ca -config " .. sslCnf .. " -passin file:" ..
    passfile .. " -gencrl -crldays " .. crl_valid_days .. " -out " .. tmpCrl .. " > /dev/null")
    ~= 0) then
    os.remove(tmpCrl)
    os.remove(passfile)
    os.remove(sslCnf)
    luci.http.prepare_content("application/json")
    luci.http.write_json({ error="Unable to issue CRL" })
    return
  end

  local reader = fork_popen(CAT .. " " .. tmpCrl)

  local filename = "crl.%s.%s.crl" % { ca_name, os.date("%Y%m%d_%H%M%S") }
  luci.http.header('Content-Disposition', 'attachment; ' ..
    'filename="' .. filename .. '"')
  luci.http.header('X-FileName', filename)
  luci.http.prepare_content("application/pkix-crl")
  luci.ltn12.pump.all(reader, luci.http.write)

  os.remove(tmpCrl)
  os.remove(passfile)
  os.remove(sslCnf)

  os.execute(LOGGER .. " 'Issued CRL from [" .. ca_name .. "]'")
end

function ca_changepassword()
  local ca_name = string.gsub(luci.http.formvalue("ca_name"), "[^A-Za-z0-9_]", "")
  local pkeypass_old = luci.http.formvalue("pkeypass_old")
  local pkeypass_new = luci.http.formvalue("pkeypass_new")

  -- create password file (old)
  local passfile_old = os.tmpname()
  local f = io.open(passfile_old, "w")
  if (f == nil) then
    os.remove(passfile_old)
    luci.http.write_json({ error="Unable to create password (old) file" })
    return 1
  end

  f:write(pkeypass_old)
  f:close()

  -- create password file (new)
  local passfile_new = os.tmpname()
  local f = io.open(passfile_new, "w")
  if (f == nil) then
    os.remove(passfile_old)
    os.remove(passfile_new)
    luci.http.write_json({ error="Unable to create password (new) file" })
    return 1
  end

  f:write(pkeypass_new)
  f:close()

  os.execute(LOGGER .. " 'Changing password of CA [" .. ca_name .. "]'")
  -- Try with RSA first
  if (os.execute(OPENSSL .. " rsa -in " .. ca_rootdir .. "/" .. ca_name ..
    "/private/cakey.pem -passin file:" .. passfile_old .. " -aes256 -out " ..
    ca_rootdir .. "/" .. ca_name .. "/private/cakey.pem.new -passout file:" ..
    passfile_new .. " > /dev/null") ~= 0) then
    -- retry with EC
    if (os.execute(OPENSSL .. " ec -in " .. ca_rootdir .. "/" .. ca_name ..
      "/private/cakey.pem -passin file:" .. passfile_old .. " -aes256 -out " ..
      ca_rootdir .. "/" .. ca_name .. "/private/cakey.pem.new -passout file:" ..
      passfile_new .. " > /dev/null") ~= 0) then
      os.remove(passfile_old)
      os.remove(passfile_new)
      luci.http.prepare_content("application/json")
      luci.http.write_json({ error="Unable to change CA password" })
      return
    end
  end

  os.remove(passfile_old)
  os.remove(passfile_new)

  if (os.execute(MV .. " " .. ca_rootdir .. "/" .. ca_name ..
    "/private/cakey.pem " .. ca_rootdir .. "/" .. ca_name ..
    "/private/cakey.pem.old") ~= 0) then
    luci.http.prepare_content("application/json")
    luci.http.write_json({ error="Unable to move CA private key file" })
  end

  if (os.execute(MV .. " " .. ca_rootdir .. "/" .. ca_name ..
    "/private/cakey.pem.new " .. ca_rootdir .. "/" .. ca_name ..
    "/private/cakey.pem") ~= 0) then
    luci.http.prepare_content("application/json")
    luci.http.write_json({ error="Unable to move CA private key file" })
  end

  if (os.execute(RM .. " " .. ca_rootdir .. "/" .. ca_name ..
    "/private/cakey.pem.old") ~= 0) then
    luci.http.prepare_content("application/json")
    luci.http.write_json({ error="Unable to remove CA private key file" })
  end

  os.execute(LOGGER .. " 'Changed password of CA [" .. ca_name .. "]'")
  luci.http.write_json({ ok="Changed password of CA [" .. ca_name .. "]" })
end

function ca_checkrestore()
  local fp
  local tmpArc = os.tmpname()
  local upload = luci.http.formvalue("backup_arc")

  luci.http.setfilehandler(
    function(meta, chunk, eof)
      if not fp and meta and meta.name == "backup_arc" then
        fp = io.open(tmpArc, "w")
      end
      if fp and chunk then
        fp:write(chunk)
      end
      if fp and eof then
        fp:close()
      end
    end
  )

  luci.http.status(200, "OK")
  luci.http.prepare_content("application/json")

  if (os.execute(TAR .. " tzf " .. tmpArc .. " > /dev/null 2>&1")
    ~= 0) then
    os.remove(tmpArc)
    luci.http.write_json({ error="Bad format. Backup must be \"tar.gz\" archive." })
    return
  end

  if (os.execute(TAR .. " tzf " .. tmpArc .. " | " ..
    "grep ^[A-Za-z0-9_]*\/private/cakey.pem$ > /dev/null 2>&1")
    ~= 0) then
    os.remove(tmpArc)
    luci.http.write_json({ error="CA private key was not found." })
    return
  end

  if (os.execute(TAR .. " tzf " .. tmpArc .. " | " ..
    "grep ^[A-Za-z0-9_]*\/cacert.pem$ > /dev/null 2>&1")
    ~= 0) then
    os.remove(tmpArc)
    luci.http.write_json({ error="CA certificate was not found." })
    return
  end

  if (os.execute(TAR .. " tzf " .. tmpArc .. " | " ..
    "grep ^[A-Za-z0-9_]*\/index.txt$ > /dev/null 2>&1")
    ~= 0) then
    os.remove(tmpArc)
    luci.http.write_json({ error="CA index.txt was not found." })
    return
  end

  os.remove(tmpArc)
  luci.http.write_json({ ok="Ready to proceed." })
end

function ca_restore()
  local fp
  local tmpArc = os.tmpname()
  local upload = luci.http.formvalue("backup_arc")

  luci.http.setfilehandler(
    function(meta, chunk, eof)
      if not fp and meta and meta.name == "backup_arc" then
        fp = io.open(tmpArc, "w")
      end
      if fp and chunk then
        fp:write(chunk)
      end
      if fp and eof then
        fp:close()
      end
    end
  )

  luci.http.status(200, "OK")
  luci.http.prepare_content("application/json")

  os.execute(LOGGER .. " 'Restoring CA...'")

  os.execute(MKDIR .. " -p " .. ca_rootdir)
  if (os.execute(TAR .. " xzf " .. tmpArc .. " -C " .. ca_rootdir ..
    " > /dev/null 2>&1")
    ~= 0) then
    os.remove(tmpArc)
    luci.http.write_json({ error="CA Restore failed." })
    return
  end

  os.remove(tmpArc)
  os.execute(LOGGER .. " 'CA restored.'")
  luci.http.write_json({ ok="CA restored." })
end

function cert_list()
  local ca_name = string.gsub(luci.http.formvalue("ca_name"), "[^A-Za-z0-9_]", "")

  luci.http.status(200, "OK")
  luci.http.prepare_content("application/json")

  f = io.open(ca_rootdir .. "/" .. ca_name .. "/cacert.pem")
  if (f == nil) then
    luci.http.write_json({ error="Unable to find CA " .. ca_name})
    return
  end

  f:close()

  local ca_serial
  f = io.popen(OPENSSL .. " x509 -in " .. ca_rootdir .. "/" .. ca_name ..
    "/cacert.pem" .. " -noout -serial | " .. SED .. " \"s/^[^=]*=//\"")
  if (f == nil) then
    luci.http.write_json({ error="Unable to find CA " .. ca_name })
    return
  end

  ca_serial = tostring(f:read())
  f:close()

  f = io.popen(CAT .. " " .. ca_rootdir .. "/" .. ca_name .. "/index.txt |" ..
    " " .. TR .. " '\t' '\n'")
  if (f == nil) then
    local r={}
    r.error = 
    luci.http.write_json({ error="Unable to open index file for CA " .. ca_name })
    return
  end

  -- first 6 lines should be ignored because it is CA itself
  for i = 1,6 do
    f:read()
  end
  
  local e={}
  local eof = false
  while (not eof) do
    local r = {}
    r.status = f:read()
    f:read() -- expired
    f:read() -- revoked?
    r.serial = f:read()
    f:read() -- ??
    r.subject = f:read()

    if (r.status == nil) then
      eof = true
    else
      d = io.popen("date -D \"%b %d %H:%M:%S %Y\" -u +\"%s\" -d \"`" .. OPENSSL ..
        " x509 -in " .. ca_rootdir .. "/" .. ca_name .. "/newcerts/" .. r.serial ..
        ".pem -noout -startdate | " .. SED .. " s/^.*=//`\"")
      if (d ~= nil) then
        r.created = d:read()
        d:close()
      end

      d = io.popen("date -D \"%b %d %H:%M:%S %Y\" -u +\"%s\" -d \"`" .. OPENSSL ..
        " x509 -in " .. ca_rootdir .. "/" .. ca_name .. "/newcerts/" .. r.serial ..
        ".pem -noout -enddate | " .. SED .. " s/^.*=//`\"")
      if (d ~= nil) then
        r.expires = d:read()
        d:close()
      end

      e[ #e + 1 ] = r
    end
  end

  f:close()

  luci.http.write_json(e)
end

function cert_check_csr()
  local fp
  local tmpCsr = os.tmpname()
  local upload = luci.http.formvalue("csr_file")

  luci.http.setfilehandler(
    function(meta, chunk, eof)
      if not fp and meta and meta.name == "csr_file" then
        fp = io.open(tmpCsr, "w")
      end
      if fp and chunk then
        fp:write(chunk)
      end
      if fp and eof then
        fp:close()
      end
    end
  )

  luci.http.status(200, "OK")
  luci.http.prepare_content("application/json")

  if (os.execute(OPENSSL .. " req -in " .. tmpCsr .. " -noout -verify > /dev/null")
    ~= 0) then
    os.remove(tmpCsr)
    luci.http.write_json({ error="Bad CSR format" })
    return
  end

  d = io.popen(OPENSSL .. " req -in " .. tmpCsr .. " -noout -subject | " ..
    SED .. " \"s/^[^=]*=//\"")
  if (d == nil) then
    os.remove(tmpCsr)
    luci.http.write_json({ error="Failed to upload CSR" })
    return
  end

  local r={}
  r.subject = tostring(d:read())

  d:close()
  os.remove(tmpCsr)

  luci.http.write_json(r)
end

function cert_issue()
  local ca_name = string.gsub(luci.http.formvalue("ca_name"), "[^A-Za-z0-9_]", "")
  local pkeypass = luci.http.formvalue("pkeypass")
  local cert_valid_days = luci.http.formvalue("cert_valid_days")
  local tmpCsr = os.tmpname()
  local upload = luci.http.formvalue("csr_file")

  local certext
  local cert_client = ""
  if (luci.http.formvalue("cert_client") ~= nil) then
    cert_client = string.lower(luci.http.formvalue("cert_client"))
  end
  local cert_server = ""
  if (luci.http.formvalue("cert_server") ~= nil) then
    cert_server = string.lower(luci.http.formvalue("cert_server"))
  end
  if (cert_client == "true") then
    if (cert_server == "true") then
      certext = "both_cert"
    else
      certext = "client_cert"
    end
  elseif (cert_server == "true") then
    certext = "server_cert"
  end

  luci.http.setfilehandler(
    function(meta, chunk, eof)
      if not fp and meta and meta.name == "csr_file" then
        fp = io.open(tmpCsr, "w")
      end
      if fp and chunk then
        fp:write(chunk)
      end
      if fp and eof then
        fp:close()
      end
    end
  )

  d = io.popen(OPENSSL .. " req -in " .. tmpCsr .. " -noout -subject | " ..
    SED .. " \"s/^[^=]*=//\"")
  if (d == nil) then
    os.remove(tmpCsr)
    luci.http.write_json({ error="Failed to upload CSR" })
    return
  end
  
  local subjectName = tostring(d:read())
  d:close()

  os.execute(LOGGER .. " 'Issuing certificate subject [" .. subjectName ..
    "] from CA [" .. ca_name .. "'")

  -- create password file
  local passfile = os.tmpname()
  local f = io.open(passfile, "w")
  if (f == nil) then
    os.remove(passfile)
    luci.http.write_json({ error="Unable to create password file" })
    return 1
  end

  f:write(pkeypass)
  f:close()

  -- Issue certificate
  local tmpCrt = os.tmpname()
  local tmpError = os.tmpname()
  local sslCnf = create_temp_opensslcnf(ca_rootdir .. "/" .. ca_name .. "/")
  if (os.execute(OPENSSL .. " ca -config " .. sslCnf .. " -passin file:" ..
    passfile .. " -policy policy_anything -in " .. tmpCsr .. " -out " ..
    tmpCrt .. " -days " .. cert_valid_days .. " -batch -keyfile " ..
    ca_rootdir .. "/" .. ca_name .. "/private/cakey.pem -extensions " .. certext .. " > " .. tmpError .. " 2>&1")
    ~= 0) then
    local f = io.open(tmpError, "r")
    local errorText = f:read("*a")
    f:close()

    os.remove(tmpCrt)
    os.remove(tmpCsr)
    os.remove(passfile)
    os.remove(sslCnf)
    os.remove(tmpError)
    luci.http.prepare_content("application/json")
    luci.http.write_json({ error="Unable to issue certificate:" .. errorText })
    return
  end

  local reader = fork_popen(CAT .. " " .. tmpCrt)

  local filename = subjectName .. '.crt'
  luci.http.header('Content-Disposition', 'attachment; ' ..
    'filename="' .. filename .. '"')
  luci.http.header('X-FileName', filename)
  luci.http.prepare_content("application/x-x509-ca-cert")
  luci.ltn12.pump.all(reader, luci.http.write)

  os.remove(tmpCrt)
  os.remove(tmpCsr)
  os.remove(passfile)
  os.remove(sslCnf)

  os.execute(LOGGER .. " 'Issued certificate subject [" .. subjectName ..
    "] from CA [" .. ca_name .. "'")
  luci.http.write_json({ ok="Issued certificate subject [" .. subjectName ..
    "] from CA [" .. ca_name .. "" })
end

function cert_downloadcert()
  local ca_name = string.gsub(luci.http.formvalue("ca_name"), "[^A-Za-z0-9_]", "")
  local cert_serial = string.upper(string.gsub(luci.http.formvalue("cert_serial"),
    "[^A-Za-z0-9_]", ""))

  local cert_pem = ca_rootdir .. "/" .. ca_name .. "/newcerts/" .. cert_serial .. ".pem"
  f = io.open(cert_pem)
  if (f == nil) then
    luci.http.write_json({ error="Unable to find certificate " .. cert_serial .. " in CA " .. ca_name })
    return
  end

  f:close()

  d = io.popen(OPENSSL .. " x509 -in " .. cert_pem .. " -noout -subject | " ..
    SED .. " \"s/^[^=]*=//\"")
  if (d == nil) then
    os.remove(tmpCsr)
    luci.http.write_json({ error="Failed to parse certificate" })
    return
  end
  
  local subjectName = tostring(d:read())
  d:close()

  os.execute(LOGGER .. " 'Downloading certificate from " .. cert_serial ..
    " from CA [" .. ca_name .. "]'")

  local reader = fork_popen(CAT .. " " .. cert_pem)

  local filename = subjectName .. '.crt'
  luci.http.header('Content-Disposition', 'attachment; ' ..
    'filename="' .. filename .. '"')
  luci.http.header('X-FileName', filename)
  luci.http.prepare_content("application/x-x509-ca-cert")
  luci.ltn12.pump.all(reader, luci.http.write)
end

function cert_revoke()
  local ca_name = string.gsub(luci.http.formvalue("ca_name"), "[^A-Za-z0-9_]", "")
  local cert_serial = string.upper(string.gsub(luci.http.formvalue("cert_serial"),
    "[^A-Za-z0-9_]", ""))
  local pkeypass = luci.http.formvalue("pkeypass")
  local revoke_reason = string.gsub(luci.http.formvalue("revoke_reason"),
    "[^A-Za-z0-9_]", "")

  if ((revoke_reason ~= "unspecified") and (revoke_reason ~= "keyCompromise") and
    (revoke_reason ~= "CACompromise") and (revoke_reason ~= "affiliationChanged") and
    (revoke_reason ~= "superseded") and (revoke_reason ~= "cessationOfOperation") and
    (revoke_reason ~= "certificateHold") and (revoke_reason ~= "removeFromCRL")) then
    luci.http.write_json({ error="Bad revocation reason [" .. revoke_reason .. "]" })
    return
  end

  local cert_pem = ca_rootdir .. "/" .. ca_name .. "/newcerts/" .. cert_serial .. ".pem"
  f = io.open(cert_pem)
  if (f == nil) then
    luci.http.write_json({ error="Unable to find certificate " .. cert_serial ..
      " in CA [" .. ca_name .. "]"})
    return
  end

  f:close()

  local ca_serial
  f = io.popen(OPENSSL .. " x509 -in " .. ca_rootdir .. "/" .. ca_name ..
    "/cacert.pem" .. " -noout -serial | " .. SED .. " \"s/^[^=]*=//\"")
  if (f == nil) then
    luci.http.write_json({ error="Unable to find CA " .. ca_name })
    return
  end

  ca_serial = tostring(f:read())
  f:close()

  if (ca_serial == cert_serial) then
    luci.http.write_json({ error="Unable to revoke cert of CA [" .. ca_name .. "] itself" })
    return
  end

  os.execute(LOGGER .. " 'Revoking certificate [" .. cert_serial ..
    "] from [" .. ca_name .. "]'")

  -- create password file
  local passfile = os.tmpname()
  local f = io.open(passfile, "w")
  if (f == nil) then
    os.remove(passfile)
    luci.http.write_json({ error="Unable to create password file" })
    return 1
  end

  f:write(pkeypass)
  f:close()

  local sslCnf = create_temp_opensslcnf(ca_rootdir .. "/" .. ca_name .. "/")
  if (os.execute(OPENSSL .. " ca -config " .. sslCnf .. " -passin file:" ..
    passfile .. " -revoke " .. ca_rootdir .. "/" .. ca_name .. "/newcerts/" ..
    cert_serial .. ".pem -crl_reason " .. revoke_reason .. " > /dev/null") ~= 0) then
    os.remove(passfile)
    os.remove(sslCnf)

    luci.http.write_json({ error="Revocation failed" })
    return
  end
  os.remove(passfile)
  os.remove(sslCnf)

  os.execute(LOGGER .. " 'Revoked certificate [" .. cert_serial ..
    "] from [" .. ca_name .. "]'")
  luci.http.write_json({ ok="Revoked certificate [" .. cert_serial ..
    "] from [" .. ca_name .. "]" })
end

function create_key_csr()
  local tempDir
  while 1 do
    tempDir = os.tmpname()
    os.remove(tempDir)
    if (os.execute(MKDIR .. " " .. tempDir) == 0) then
      break
    end
  end
  
  local filenamebase = string.gsub(luci.http.formvalue("commonname"),
    "[^A-Za-z0-9_.]", "")

  if (genPkeyAndCsr(tempDir .. "/" .. filenamebase .. ".key",
    tempDir .. "/" .. filenamebase .. ".csr") ~= 0) then
    luci.http.write_json({ error="Unable to generate private key & csr" })
    return
  end

  local filename = "pkey-and-csr.%s.tar.gz" % { os.date("%Y%m%d_%H%M%S") }
  local reader = fork_popen(TAR .. " czC " .. tempDir .. " " ..
    filenamebase .. ".key " .. filenamebase .. ".csr")
  luci.http.header('Content-Disposition', 'attachment; ' ..
    'filename="' .. filename .. '"')
  luci.http.header('X-FileName', filename)
  luci.http.prepare_content("application/x-compressed-tar")
  luci.ltn12.pump.all(reader, luci.http.write)

  os.remove(tempDir .. "/" .. filenamebase .. ".key")
  os.remove(tempDir .. "/" .. filenamebase .. ".csr")
  os.remove(tempDir)
end
