const networkInput = document.querySelector("#network-input");
const errorMessage = document.querySelector("#error-message");
const results = document.querySelector("#results");
const resultList = document.querySelector("#result-list");
const COPY_ICON = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M9 9a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2z"></path>
    <path d="M6 15H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v1"></path>
  </svg>
`;

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

function isIpv6Token(value) {
  return value.includes(":");
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

    if (isIpv6Token(ipPart)) {
      return {
        version: 6,
        ip: ipPart,
        cidr: Number(suffixPart)
      };
    }

    if (isIpv4Token(suffixPart)) {
      return {
        version: 4,
        ip: ipPart,
        cidr: maskToCidr(suffixPart)
      };
    }

    return {
      version: 4,
      ip: ipPart,
      cidr: Number(suffixPart)
    };
  }

  const parts = normalized.split(/[,\s]+/).filter(Boolean);
  if (parts.length === 1) {
    throw new Error("CIDR またはサブネットマスクも含めて入力してください。");
  }

  const [ipPart, suffixPart] = parts;
  if (!ipPart || !suffixPart) {
    throw new Error("入力形式を解釈できませんでした。");
  }

  if (isIpv6Token(ipPart)) {
    return {
      version: 6,
      ip: ipPart,
      cidr: Number(suffixPart)
    };
  }

  if (isIpv4Token(suffixPart)) {
    return {
      version: 4,
      ip: ipPart,
      cidr: maskToCidr(suffixPart)
    };
  }

  return {
    version: 4,
    ip: ipPart,
    cidr: Number(suffixPart)
  };
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
    version: 4,
    items: [
      { label: "Network", value: intToIp(networkInt) },
      { label: "Broadcast", value: intToIp(broadcastInt) },
      { label: "CIDR", value: String(cidr) },
      { label: "Subnet", value: intToIp(maskInt) },
      { label: "Wildmask", value: intToIp(wildcardInt) },
      { label: "Hosts", value: usableHosts.toLocaleString("en-US") }
    ]
  };
}

function parseIpv6(ip) {
  const normalized = ip.toLowerCase();
  if (!/^[0-9a-f:]+$/.test(normalized)) {
    throw new Error("IPv6 アドレスの形式が不正です。");
  }

  if (normalized.includes(":::")) {
    throw new Error("IPv6 アドレスの形式が不正です。");
  }

  const parts = normalized.split("::");
  if (parts.length > 2) {
    throw new Error("IPv6 アドレスの形式が不正です。");
  }
  const hasCompression = normalized.includes("::");

  const left = parts[0] ? parts[0].split(":").filter(Boolean) : [];
  const right = parts[1] ? parts[1].split(":").filter(Boolean) : [];

  if (!hasCompression && left.length !== 8) {
    throw new Error("IPv6 アドレスは 8 ヘクステットで入力してください。");
  }

  if (left.length + right.length > 8) {
    throw new Error("IPv6 アドレスの形式が不正です。");
  }

  const missingCount = 8 - left.length - right.length;
  const expanded = [...left, ...Array(missingCount).fill("0"), ...right];

  if (expanded.length !== 8) {
    throw new Error("IPv6 アドレスの形式が不正です。");
  }

  return expanded.map((part) => {
    if (!/^[0-9a-f]{1,4}$/.test(part)) {
      throw new Error("IPv6 アドレスの形式が不正です。");
    }
    return part.padStart(4, "0");
  });
}

function ipv6ToBigInt(parts) {
  return parts.reduce((value, part) => (value << 16n) + BigInt(`0x${part}`), 0n);
}

function bigIntToIpv6(value) {
  const parts = [];
  let current = value;
  for (let index = 0; index < 8; index += 1) {
    parts.unshift(Number(current & 0xffffn).toString(16).padStart(4, "0"));
    current >>= 16n;
  }
  return parts;
}

function compressIpv6(parts) {
  const shortened = parts.map((part) => part.replace(/^0+/, "") || "0");
  let bestStart = -1;
  let bestLength = 0;
  let currentStart = -1;
  let currentLength = 0;

  shortened.forEach((part, index) => {
    if (part === "0") {
      if (currentStart === -1) {
        currentStart = index;
        currentLength = 1;
      } else {
        currentLength += 1;
      }

      if (currentLength > bestLength) {
        bestStart = currentStart;
        bestLength = currentLength;
      }
    } else {
      currentStart = -1;
      currentLength = 0;
    }
  });

  if (bestLength < 2) {
    return shortened.join(":");
  }

  const head = shortened.slice(0, bestStart).join(":");
  const tail = shortened.slice(bestStart + bestLength).join(":");

  if (!head && !tail) {
    return "::";
  }

  if (!head) {
    return `::${tail}`;
  }

  if (!tail) {
    return `${head}::`;
  }

  return `${head}::${tail}`;
}

function calculateIpv6(ip, cidr) {
  if (!Number.isInteger(cidr) || cidr < 0 || cidr > 128) {
    throw new Error("IPv6 prefix は 0 から 128 の整数で入力してください。");
  }

  const expandedParts = parseIpv6(ip);
  const ipInt = ipv6ToBigInt(expandedParts);
  const shift = 128n - BigInt(cidr);
  const networkInt = shift === 128n ? 0n : (ipInt >> shift) << shift;
  const networkParts = bigIntToIpv6(networkInt);

  return {
    version: 6,
    items: [
      { label: "Compressed", value: `${compressIpv6(expandedParts)}/${cidr}` },
      { label: "Expanded", value: `${expandedParts.join(":")}/${cidr}` },
      { label: "Network", value: `${compressIpv6(networkParts)}/${cidr}` }
    ]
  };
}

function renderResult(data) {
  resultList.innerHTML = "";
  resultList.classList.toggle("single-column", data.version === 6);

  data.items.forEach((item, index) => {
    const valueId = `result-value-${index}`;
    const row = document.createElement("div");
    row.className = "result-row";
    row.innerHTML = `
      <div class="result-head">
        <span>${item.label}</span>
        <button class="copy-button" data-copy-target="${valueId}" type="button" aria-label="Copy ${item.label}">
          ${COPY_ICON}
        </button>
      </div>
      <code id="${valueId}"></code>
    `;
    row.querySelector("code").textContent = item.value;
    resultList.appendChild(row);
  });

  resultList.querySelectorAll(".copy-button").forEach((button) => {
    button.addEventListener("click", copyResult);
  });

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
    const result = parsed.version === 6
      ? calculateIpv6(parsed.ip, parsed.cidr)
      : calculateNetwork(parsed.ip, parsed.cidr);
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

networkInput.value = "192.168.10.14 255.255.255.0";
updateCalculation();
