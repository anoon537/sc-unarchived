(() => {
  const $ = (id) => document.getElementById(id);
  const SESSION_KEY = "socialchat-archive-session";
  let savedSession = null;
  try {
    savedSession = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
  }
  const state = {
    credentials: {
      accessToken: typeof savedSession?.accessToken === "string" ? savedSession.accessToken : "",
      refreshToken: typeof savedSession?.refreshToken === "string" ? savedSession.refreshToken : "",
    },
    preview: null,
    busy: false,
  };
  const BATCH_SIZE = 5;

  const fields = {
    email: $("login-email"),
    password: $("login-password"),
    from: $("from-date"),
    to: $("to-date"),
    confirmation: $("confirm-input"),
  };

  function showNotice(message, kind = "info") {
    const notice = $("notice");
    notice.textContent = message;
    notice.dataset.kind = kind;
    notice.hidden = false;
  }

  function clearNotice() {
    $("notice").hidden = true;
  }

  function setBusy(busy) {
    state.busy = busy;
    $("preview-button").disabled = busy;
    $("unarchive-button").disabled = busy;
    $("login-button").disabled = busy;
    $("logout-button").disabled = busy;
    fields.email.disabled = busy;
    fields.password.disabled = busy;
    fields.from.disabled = busy;
    fields.to.disabled = busy;
  }

  function setCredentials(credentials) {
    state.credentials = {
      accessToken: credentials?.accessToken || state.credentials.accessToken,
      refreshToken: credentials?.refreshToken || state.credentials.refreshToken,
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(state.credentials));
    $("session-status").textContent = `Terhubung${credentials?.user?.name ? ` sebagai ${credentials.user.name}` : " ke Socialchat"}.`;
    $("login-form").hidden = true;
    $("session-area").hidden = false;
  }

  async function login() {
    clearNotice();
    if (!fields.email.value.trim() || !fields.password.value) {
      showNotice("Masukkan email dan password Socialchat.", "error");
      return;
    }
    setBusy(true);
    try {
      const session = await postJson("/api/login", {
        email: fields.email.value.trim(),
        password: fields.password.value,
      });
      setCredentials(session);
      fields.password.value = "";
      showNotice("Login Socialchat berhasil. Pilih rentang tanggal untuk melanjutkan.", "success");
    } catch (error) {
      showNotice(error.message || "Login Socialchat gagal.", "error");
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    state.credentials = { accessToken: "", refreshToken: "" };
    state.preview = null;
    sessionStorage.removeItem(SESSION_KEY);
    fields.email.value = "";
    fields.password.value = "";
    $("login-form").hidden = false;
    $("session-area").hidden = true;
    $("preview-panel").hidden = true;
    clearNotice();
  }

  async function postJson(url, body) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok && response.status !== 207) {
      throw new Error(data.error || `Permintaan gagal (${response.status}).`);
    }
    return data;
  }

  function validateRange() {
    const fromDate = fields.from.value;
    const toDate = fields.to.value;
    if (!fromDate || !toDate) throw new Error("Pilih tanggal awal dan akhir terlebih dahulu.");
    if (fromDate > toDate) throw new Error("Tanggal awal harus sama dengan atau sebelum tanggal akhir.");
    return { fromDate, toDate };
  }

  function renderPreview(preview) {
    $("preview-panel").hidden = false;
    $("range-summary").textContent = `${preview.fromDate} sampai ${preview.toDate} \u00b7 zona waktu Jakarta`;
    $("eligible-count").textContent = preview.entries.length.toLocaleString("id-ID");
    $("excluded-count").textContent = preview.excludedAfterDate.toLocaleString("id-ID");
    $("missing-count").textContent = preview.excludedMissingDate.toLocaleString("id-ID");
    $("confirm-phrase").textContent = `UNARSIP ${preview.entries.length}`;
    $("action-area").hidden = preview.entries.length === 0;
    $("progress-area").hidden = true;
  }

  async function createPreview() {
    clearNotice();
    try {
      const range = validateRange();
      if (!state.credentials.accessToken) throw new Error("Login ke Socialchat terlebih dahulu.");
      setBusy(true);
      state.preview = null;
      $("preview-panel").hidden = true;
      showNotice("Mengambil daftar Arsip dan menghitung yang cocok...", "info");

      const nonceBytes = crypto.getRandomValues(new Uint8Array(24));
      const nonce = Array.from(nonceBytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
      const expiresAt = Date.now() + 90 * 60 * 1000;
      let page = 1;
      let pageCount = null;
      let totalDocs = null;
      let excludedAfterDate = 0;
      let excludedMissingDate = 0;
      const entries = [];

      while (true) {
        const result = await postJson("/api/preview", {
          ...range,
          page,
          nonce,
          expiresAt,
          credentials: state.credentials,
        });
        setCredentials(result.credentials);
        entries.push(...result.eligible);
        excludedAfterDate += result.excludedAfterDate;
        excludedMissingDate += result.excludedMissingDate;
        if (result.totalDocs !== null) totalDocs = result.totalDocs;
        if (result.totalPages !== null) pageCount = result.totalPages;

        const found = totalDocs !== null ? ` dari ${totalDocs.toLocaleString("id-ID")}` : "";
        const pages = pageCount ? ` \u00b7 halaman ${page}/${pageCount}` : ` \u00b7 halaman ${page}`;
        showNotice(`Memindai Arsip: ${entries.length.toLocaleString("id-ID")} cocok${found}${pages}.`, "info");

        if (!result.hasNextPage) break;
        page += 1;
        if (page > 500) throw new Error("Batas halaman pratinjau tercapai. Persempit rentang tanggal lalu coba lagi.");
      }

      state.preview = { ...range, nonce, expiresAt, entries, excludedAfterDate, excludedMissingDate };
      renderPreview(state.preview);
      showNotice(
        entries.length
          ? `Pratinjau siap: ${entries.length.toLocaleString("id-ID")} percakapan memenuhi rentang tanggal.`
          : "Tidak ada percakapan Arsip yang cocok dengan rentang tanggal tersebut.",
        entries.length ? "success" : "info",
      );
    } catch (error) {
      showNotice(error.message || "Pratinjau gagal. Coba lagi.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function unarchiveAll() {
    clearNotice();
    if (!state.preview || !state.preview.entries.length) return;
    const expected = `UNARSIP ${state.preview.entries.length}`;
    if (fields.confirmation.value.trim() !== expected) {
      showNotice(`Ketik persis \u201c${expected}\u201d untuk mengonfirmasi.`, "error");
      return;
    }
    setBusy(true);
    $("progress-area").hidden = false;
    $("unarchive-button").disabled = true;
    let succeeded = 0;
    const total = state.preview.entries.length;
    let stopped = false;

    try {
      for (let start = 0; start < total; start += BATCH_SIZE) {
        const batch = state.preview.entries.slice(start, start + BATCH_SIZE);
        const result = await postJson("/api/unarchive", {
          credentials: state.credentials,
          fromDate: state.preview.fromDate,
          toDate: state.preview.toDate,
          nonce: state.preview.nonce,
          expiresAt: state.preview.expiresAt,
          entries: batch,
        });
        setCredentials(result.credentials);
        succeeded += result.succeeded;
        const percent = Math.floor((succeeded / total) * 100);
        $("progress-bar").style.width = `${percent}%`;
        $("progress-value").textContent = `${percent}%`;
        $("progress-label").textContent = `${succeeded.toLocaleString("id-ID")} dari ${total.toLocaleString("id-ID")}`;

        if (result.stopped || result.failed > 0) {
          stopped = true;
          throw new Error(result.error || "Proses berhenti karena sebagian permintaan gagal.");
        }
      }

      $("eligible-count").textContent = "0";
      $("action-area").hidden = true;
      $("confirm-input").value = "";
      state.preview = null;
      showNotice(`${succeeded.toLocaleString("id-ID")} percakapan berhasil dikeluarkan dari Arsip.`, "success");
    } catch (error) {
      const detail = succeeded ? ` Berhasil sebelum berhenti: ${succeeded} dari ${total}.` : "";
      showNotice(`${error.message || "Unarsip gagal."}${detail} Buat pratinjau baru untuk melanjutkan.`, "error");
      if (!stopped && !succeeded) $("progress-area").hidden = true;
    } finally {
      setBusy(false);
      $("unarchive-button").disabled = false;
    }
  }

  $("preview-button").addEventListener("click", createPreview);
  $("unarchive-button").addEventListener("click", unarchiveAll);
  $("login-button").addEventListener("click", login);
  $("logout-button").addEventListener("click", logout);

  if (state.credentials.accessToken) {
    $("login-form").hidden = true;
    $("session-area").hidden = false;
    $("session-status").textContent = "Sesi dipulihkan dari tab ini. Buat pratinjau baru untuk melanjutkan.";
  }
})();

