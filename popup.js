const networkInput = document.querySelector("#network-input");
const errorMessage = document.querySelector("#error-message");
const results = document.querySelector("#results");
const copyButtons = document.querySelectorAll(".copy-button");

const fields = {
  cidr: document.querySelector("#result-cidr"),
  mask: document.querySelector("#result-mask"),
  wildcard: document.querySelector("#result-wildcard"),
  network: document.querySelector("#result-network"),
  broadcast: document.querySelector("#result-broadcast"),
  hosts: document.querySelector("#result-hosts")
};

function ipToInt(ip) {
  const octets = ip.split(".");
  if (octets.length !== 4) {
    throw new Error("IPv4 アドレスは 4 オクテットで入力してください。");
  }

  const numbers = octets.map((octet) => {
    if (!/^\d+$/.test(octet)) {
      throw new Error("IP アドレスは 0 から 255 の数字で入力してください。");
    }

    const value = Number(octet);
    if (value < 0 || value > 255) {
      throw new Error("IP アドレスは 0 から 255 の範囲で入力してください。");
    }

    return value;
  });

  return (
    ((numbers[0] << 24) >>> 0) +
    ((numbers[1] << 16) >>> 0) +
    ((numbers[2] << 8) >>> 0) +
    numbers[3]
  ) >>> 0;
}

function intToIp(value) {
  return [
    (value >>> 24) & 255,
    (value >>> 16) & 255,
    (value >>> 8) & 255,
    value & 255
  ].join(".");
}

function cidrToMask(cidr) {
  if (!Number.isInteger(cidr) || cidr < 0 || cidr > 32) {
    throw new Error("CIDR は 0 から 32 の整数で入力してください。");
  }

  if (cidr === 0) {
    return 0;
  }

  return (0xffffffff << (32 - cidr)) >>> 0;
}

function maskToCidr(mask) {
  const maskInt = ipToInt(mask);
  let seenZero = false;
  let cidr = 0;

  for (let bit = 31; bit >= 0; bit -= 1) {
    const isOne = ((maskInt >>> bit) & 1) === 1;
    if (isOne && seenZero) {
      throw new Error("サブネットマスクが不正です。");
    }
    if (isOne) {
      cidr += 1;
    } else {
      seenZero = true;
    }
  }

  return cidr;
}

function isIpv4Token(value) {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(value);
}

function parseInput(rawValue) {
  const normalized = rawValue.trim().replace(/\s*\/\s*/g, "/");

  if (!normalized) {
    throw new Error("IP アドレスを入力してください。");
  }

  if (normalized.includes("/")) {
    const [ipPart, suffixPart] = normalized.split("/");
    if (!ipPart || !suffixPart) {
      throw new Error("`IP/CIDR` か `IP/subnet mask` の形式で入力してください。");
    }

    if (isIpv4Token(suffixPart)) {
      return { ip: ipPart, cidr: maskToCidr(suffixPart) };
    }

    return { ip: ipPart, cidr: Number(suffixPart) };
  }

  const parts = normalized.split(/[,\s]+/).filter(Boolean);
  if (parts.length === 1) {
    throw new Error("CIDR またはサブネットマスクも含めて入力してください。");
  }

  const [ipPart, suffixPart] = parts;
  if (!ipPart || !suffixPart) {
    throw new Error("入力形式を解釈できませんでした。");
  }

  if (isIpv4Token(suffixPart)) {
    return { ip: ipPart, cidr: maskToCidr(suffixPart) };
  }

  return { ip: ipPart, cidr: Number(suffixPart) };
}

function isCompleteInput(rawValue) {
  const value = rawValue.trim();
  if (!value) {
    return false;
  }

  if (value.includes("/")) {
    const [ipPart, suffixPart] = value.replace(/\s*\/\s*/g, "/").split("/");
    return Boolean(ipPart && suffixPart);
  }

  const parts = value.split(/[,\s]+/).filter(Boolean);
  return parts.length >= 2;
}

function calculateNetwork(ip, cidr) {
  const ipInt = ipToInt(ip);
  const maskInt = cidrToMask(cidr);
  const wildcardInt = (~maskInt) >>> 0;
  const networkInt = (ipInt & maskInt) >>> 0;
  const broadcastInt = (networkInt | wildcardInt) >>> 0;
  const totalAddresses = 2 ** (32 - cidr);

  let usableHosts;
  if (cidr === 32) {
    usableHosts = 1;
  } else if (cidr === 31) {
    usableHosts = 2;
  } else {
    usableHosts = Math.max(totalAddresses - 2, 0);
  }

  return {
    cidr,
    subnetMask: intToIp(maskInt),
    wildcardMask: intToIp(wildcardInt),
    networkAddress: intToIp(networkInt),
    broadcastAddress: intToIp(broadcastInt),
    usableHosts: usableHosts.toLocaleString("en-US")
  };
}

function renderResult(data) {
  fields.cidr.textContent = `/${data.cidr}`;
  fields.mask.textContent = data.subnetMask;
  fields.wildcard.textContent = data.wildcardMask;
  fields.network.textContent = data.networkAddress;
  fields.broadcast.textContent = data.broadcastAddress;
  fields.hosts.textContent = data.usableHosts;
  results.classList.remove("hidden");
}

function hideResult() {
  results.classList.add("hidden");
}

function setError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.toggle("has-text", Boolean(message));
}

function updateCalculation() {
  try {
    const rawValue = networkInput.value;
    if (!rawValue.trim()) {
      setError("");
      hideResult();
      return;
    }

    if (!isCompleteInput(rawValue)) {
      setError("");
      return;
    }

    const parsed = parseInput(rawValue);
    const result = calculateNetwork(parsed.ip, parsed.cidr);
    setError("");
    renderResult(result);
  } catch (error) {
    hideResult();
    setError(error.message);
  }
}

async function copyResult(event) {
  const targetId = event.currentTarget.dataset.copyTarget;
  const valueNode = document.getElementById(targetId);
  if (!valueNode || !valueNode.textContent) {
    return;
  }

  await copyText(valueNode.textContent);
  setError("");
  flashCopied(event.currentTarget);
}

async function copyText(value) {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch (_error) {
      // Fall through to the legacy copy path.
    }
  }

  if (typeof document.execCommand === "function") {
    const helper = document.createElement("textarea");
    helper.value = value;
    helper.setAttribute("readonly", "");
    helper.style.position = "fixed";
    helper.style.top = "-9999px";
    helper.style.left = "-9999px";
    document.body.appendChild(helper);
    helper.select();
    helper.setSelectionRange(0, helper.value.length);

    try {
      document.execCommand("copy");
      return;
    } finally {
      document.body.removeChild(helper);
    }
  }
}

function flashCopied(button) {
  button.classList.add("copied");
  setTimeout(() => {
    button.classList.remove("copied");
  }, 700);
}

networkInput.addEventListener("input", updateCalculation);
networkInput.addEventListener("focus", () => {
  networkInput.select();
});

copyButtons.forEach((button) => {
  button.addEventListener("click", copyResult);
});

networkInput.value = "192.168.10.14 255.255.255.0";
updateCalculation();
