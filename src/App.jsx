import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  AlertDescription,
  AlertIcon,
  Badge,
  Box,
  Button,
  Checkbox,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  IconButton,
  Input,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Spacer,
  Stack,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from "@chakra-ui/react";
import {
  AddIcon,
  CalendarIcon,
  CloseIcon,
  DeleteIcon,
  EditIcon,
  HamburgerIcon,
  SearchIcon,
} from "@chakra-ui/icons";

const SESSION_KEY = "socialchat-archive-session";
const BATCH_SIZE = 5;
const templates = [
  { suffix: "adm18", textColor: "#fff", backgroundColor: "#E06767" },
  { suffix: "akbar", textColor: "#fff", backgroundColor: "#262626" },
  { suffix: "azka", textColor: "#000", backgroundColor: "#F1BCBC" },
  { suffix: "dewi", textColor: "#fff", backgroundColor: "#724100" },
  { suffix: "endah", textColor: "#fff", backgroundColor: "#FFA125" },
  { suffix: "fira", textColor: "#000", backgroundColor: "#FFD195" },
  { suffix: "inspi1", textColor: "#fff", backgroundColor: "#724100" },
  { suffix: "mei", textColor: "#fff", backgroundColor: "#335A2F" },
];
const panel = {
  bg: "#2c372f",
  border: "1px solid #75805d",
  borderRadius: "4px",
  p: { base: 5, md: 7 },
  boxShadow: "5px 6px 0 rgba(0, 0, 0, .24)",
};

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok && response.status !== 207)
    throw new Error(data.error || `Permintaan gagal (${response.status}).`);
  return data;
}

function readSession() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null") || {};
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
    return {};
  }
}

export default function App() {
  const [credentials, setCredentials] = useState(readSession);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("archive");
  const [notice, setNotice] = useState(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [preview, setPreview] = useState(null);
  const [confirmation, setConfirmation] = useState("");
  const [progress, setProgress] = useState(null);
  const [labels, setLabels] = useState([]);
  const [labelsLoaded, setLabelsLoaded] = useState(false);
  const [selected, setSelected] = useState([]);
  const [editing, setEditing] = useState(null);
  const [labelForm, setLabelForm] = useState({
    name: "",
    textColor: "#fff",
    backgroundColor: "#724100",
  });
  const [prefix, setPrefix] = useState("'15 nov");
  const [weeklyProgress, setWeeklyProgress] = useState("");
  const loggedIn = Boolean(credentials.accessToken);
  const notify = (message, kind = "info") => setNotice({ message, kind });
  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const saveCredentials = (result) => {
    const next = {
      accessToken: result?.accessToken || credentials.accessToken || "",
      refreshToken: result?.refreshToken || credentials.refreshToken || "",
      user: result?.user || credentials.user,
    };
    setCredentials(next);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
  };

  async function login(event) {
    event?.preventDefault();
    setNotice(null);
    if (!email.trim() || !password)
      return notify("Masukkan email dan password Socialchat.", "error");
    setBusy(true);
    try {
      const result = await postJson("/api/login", {
        email: email.trim(),
        password,
      });
      saveCredentials(result);
      setPassword("");
      notify("Login Socialchat berhasil.", "success");
    } catch (error) {
      notify(error.message || "Login Socialchat gagal.", "error");
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    setCredentials({});
    setPreview(null);
    setLabels([]);
    setLabelsLoaded(false);
    setSelected([]);
    setTab("archive");
    setNotice(null);
    setPassword("");
  }

  async function labelRequest(action, values = {}) {
    const result = await postJson("/api/labels", {
      action,
      ...values,
      credentials,
    });
    if (result.credentials) saveCredentials(result.credentials);
    return result;
  }

  async function fetchLabels() {
    const rows = [];
    let page = 1;
    while (page <= 500) {
      const result = await labelRequest("list", { page });
      rows.push(...(result.rows || []));
      if (!result.hasNextPage) break;
      page++;
    }
    if (page > 500) throw new Error("Batas halaman label tercapai.");
    setLabels(rows);
    setSelected([]);
    setLabelsLoaded(true);
  }
  async function loadLabels(success = false) {
    if (!credentials.accessToken)
      return notify("Login ke Socialchat terlebih dahulu.", "error");
    setBusy(true);
    try {
      await fetchLabels();
      if (success)
        notify("Daftar label diperbarui dari Socialchat.", "success");
    } catch (error) {
      notify(
        error.message || "Gagal mengambil label dari Socialchat.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (loggedIn && tab === "labels" && !labelsLoaded && !busy) loadLabels();
  }, [loggedIn, tab]);

  async function saveLabel(event) {
    event.preventDefault();
    const name = labelForm.name.trim();
    if (!name) return notify("Nama label wajib diisi.", "error");
    const values = { ...labelForm, name };
    if (editing) {
      values.id = editing.id;
      if (editing.chatStageId != null) values.chatStageId = editing.chatStageId;
      if (editing.automation != null) values.automation = editing.automation;
    }
    setBusy(true);
    try {
      await labelRequest(editing ? "update" : "create", values);
      await fetchLabels();
      setEditing(null);
      setLabelForm({ name: "", textColor: "#fff", backgroundColor: "#724100" });
      notify(
        editing ? "Label berhasil diperbarui." : "Label berhasil dibuat.",
        "success",
      );
    } catch (error) {
      notify(error.message || "Gagal menyimpan label.", "error");
    } finally {
      setBusy(false);
    }
  }
  async function deleteLabels(list) {
    if (!list.length) return;
    const noun =
      list.length === 1
        ? `label “${list[0].name}”`
        : `${list.length} label terpilih`;
    if (
      !window.confirm(
        `Hapus ${noun} dari Socialchat? Tindakan ini tidak dapat dibatalkan.`,
      )
    )
      return;
    setBusy(true);
    let deleted = 0;
    try {
      for (const item of list) {
        await labelRequest("delete", { id: item.id });
        deleted++;
      }
      await fetchLabels();
      if (list.some((item) => item.id === editing?.id)) {
        setEditing(null);
        setLabelForm({
          name: "",
          textColor: "#fff",
          backgroundColor: "#724100",
        });
      }
      notify(`${deleted} label berhasil dihapus dari Socialchat.`, "success");
    } catch (error) {
      setLabelsLoaded(false);
      try {
        await fetchLabels();
      } catch {}
      notify(
        `${error.message || "Gagal menghapus label."}${deleted ? ` ${deleted} sudah terhapus.` : ""}`,
        "error",
      );
    } finally {
      setBusy(false);
    }
  }
  const weeklyLabels = useMemo(
    () =>
      prefix.trim()
        ? templates.map((t) => ({ ...t, name: `${prefix.trim()} ${t.suffix}` }))
        : [],
    [prefix],
  );
  async function createWeekly(event) {
    event.preventDefault();
    if (!prefix.trim() || prefix.trim().length > 100)
      return notify("Isi awalan tanggal yang valid.", "error");
    setBusy(true);
    let created = 0;
    try {
      if (!labelsLoaded) await fetchLabels();
      const existing = new Set(
        labels.map((item) => item.name.trim().toLocaleLowerCase("id-ID")),
      );
      const duplicates = weeklyLabels.filter((item) =>
        existing.has(item.name.toLocaleLowerCase("id-ID")),
      );
      if (duplicates.length)
        throw new Error(
          `Label sudah ada: ${duplicates.map((item) => item.name).join(", ")}. Ganti awalan tanggal.`,
        );
      if (
        !window.confirm(
          `Buat 8 label berikut di Socialchat?\n\n${weeklyLabels.map((item) => item.name).join("\n")}`,
        )
      )
        return;
      for (const item of weeklyLabels) {
        await labelRequest("create", item);
        created++;
        setWeeklyProgress(`Label dibuat: ${created} dari 8`);
      }
      setLabelsLoaded(false);
      await fetchLabels();
      notify("8 label mingguan berhasil dibuat di Socialchat.", "success");
    } catch (error) {
      if (created) {
        setLabelsLoaded(false);
        try {
          await fetchLabels();
        } catch {}
      }
      notify(
        `${error.message || "Gagal membuat label mingguan."}${created ? ` Sudah dibuat ${created} dari 8 label.` : ""}`,
        "error",
      );
    } finally {
      setBusy(false);
      setWeeklyProgress("");
    }
  }
  async function createPreview() {
    setNotice(null);
    if (!fromDate || !toDate)
      return notify("Pilih tanggal awal dan akhir terlebih dahulu.", "error");
    if (fromDate > toDate)
      return notify(
        "Tanggal awal harus sama dengan atau sebelum tanggal akhir.",
        "error",
      );
    if (!credentials.accessToken)
      return notify("Login ke Socialchat terlebih dahulu.", "error");
    setBusy(true);
    setPreview(null);
    try {
      const nonce = Array.from(
        crypto.getRandomValues(new Uint8Array(24)),
        (byte) => byte.toString(16).padStart(2, "0"),
      ).join("");
      const expiresAt = Date.now() + 90 * 60 * 1000;
      let page = 1;
      let totalDocs = null;
      let totalPages = null;
      let excludedAfterDate = 0;
      let excludedMissingDate = 0;
      const entries = [];
      while (true) {
        const result = await postJson("/api/preview", {
          fromDate,
          toDate,
          page,
          nonce,
          expiresAt,
          credentials,
        });
        if (result.credentials) saveCredentials(result.credentials);
        entries.push(...result.eligible);
        excludedAfterDate += result.excludedAfterDate;
        excludedMissingDate += result.excludedMissingDate;
        if (result.totalDocs !== null) totalDocs = result.totalDocs;
        if (result.totalPages !== null) totalPages = result.totalPages;
        notify(
          `Memindai Arsip: ${entries.length.toLocaleString("id-ID")} cocok${totalDocs !== null ? ` dari ${totalDocs.toLocaleString("id-ID")}` : ""} · halaman ${page}${totalPages ? `/${totalPages}` : ""}.`,
        );
        if (!result.hasNextPage) break;
        if (++page > 500)
          throw new Error(
            "Batas halaman pratinjau tercapai. Persempit rentang tanggal lalu coba lagi.",
          );
      }
      setPreview({
        fromDate,
        toDate,
        nonce,
        expiresAt,
        entries,
        excludedAfterDate,
        excludedMissingDate,
      });
      setConfirmation("");
      notify(
        entries.length
          ? `Pratinjau siap: ${entries.length.toLocaleString("id-ID")} percakapan memenuhi rentang tanggal.`
          : "Tidak ada percakapan Arsip yang cocok.",
        entries.length ? "success" : "info",
      );
    } catch (error) {
      notify(error.message || "Pratinjau gagal. Coba lagi.", "error");
    } finally {
      setBusy(false);
    }
  }
  async function unarchive() {
    if (!preview?.entries?.length) return;
    const expected = `UNARSIP ${preview.entries.length}`;
    if (confirmation.trim() !== expected)
      return notify(`Ketik persis “${expected}” untuk mengonfirmasi.`, "error");
    setBusy(true);
    setProgress({ done: 0, total: preview.entries.length });
    let succeeded = 0;
    let stopped = false;
    try {
      for (let start = 0; start < preview.entries.length; start += BATCH_SIZE) {
        const result = await postJson("/api/unarchive", {
          credentials,
          fromDate: preview.fromDate,
          toDate: preview.toDate,
          nonce: preview.nonce,
          expiresAt: preview.expiresAt,
          entries: preview.entries.slice(start, start + BATCH_SIZE),
        });
        if (result.credentials) saveCredentials(result.credentials);
        succeeded += result.succeeded;
        setProgress({ done: succeeded, total: preview.entries.length });
        if (result.stopped || result.failed > 0) {
          stopped = true;
          throw new Error(
            result.error || "Proses berhenti karena sebagian permintaan gagal.",
          );
        }
      }
      setPreview(null);
      setConfirmation("");
      notify(
        `${succeeded.toLocaleString("id-ID")} percakapan berhasil dikeluarkan dari Arsip.`,
        "success",
      );
    } catch (error) {
      notify(
        `${error.message || "Unarsip gagal."}${succeeded ? ` Berhasil sebelum berhenti: ${succeeded} dari ${preview.entries.length}.` : ""} Buat pratinjau baru untuk melanjutkan.`,
        "error",
      );
      if (!stopped && !succeeded) setProgress(null);
    } finally {
      setBusy(false);
    }
  }

  if (!loggedIn)
    return (
      <Login
        email={email}
        setEmail={setEmail}
        password={password}
        setPassword={setPassword}
        busy={busy}
        onLogin={login}
        notice={notice}
        dismiss={() => setNotice(null)}
      />
    );
  return (
    <Flex minH="100vh" bg="#202b24">
      <Box flex="1" minW="0" className="main-area">
        <Flex className="topbar" align="center">
          <Menu>
            <MenuButton
              as={IconButton}
              className="mobile-menu-button"
              aria-label="Buka menu navigasi"
              icon={<HamburgerIcon />}
              variant="outline"
            />
            <MenuList className="mobile-menu-list">
              <MenuItem
                onClick={() => setTab("archive")}
                className={tab === "archive" ? "selected" : ""}
              >
                Arsip chat
              </MenuItem>
              <MenuItem
                onClick={() => setTab("labels")}
                className={tab === "labels" ? "selected" : ""}
              >
                Kelola label
              </MenuItem>
            </MenuList>
          </Menu>
          <Text className="topbar-brand">SOCIALCHAT</Text>
          <HStack className="desktop-nav">
            <Button
              className={tab === "archive" ? "selected" : ""}
              onClick={() => setTab("archive")}
            >
              Arsip chat
            </Button>
            <Button
              className={tab === "labels" ? "selected" : ""}
              onClick={() => setTab("labels")}
            >
              Kelola label
            </Button>
          </HStack>
          <Spacer />
          <HStack spacing="3">
            <Badge className="account-badge" colorScheme="green" px="3" py="1">
              AKUN AKTIF
            </Badge>
            <Button className="logout-button" size="sm" onClick={logout}>
              Logout
            </Button>
          </HStack>
        </Flex>
        <Box className="page-content">
          {tab === "archive" ? (
            <Archive
              fromDate={fromDate}
              setFromDate={setFromDate}
              toDate={toDate}
              setToDate={setToDate}
              busy={busy}
              onPreview={createPreview}
              preview={preview}
              confirmation={confirmation}
              setConfirmation={setConfirmation}
              onUnarchive={unarchive}
              progress={progress}
            />
          ) : (
            <Labels
              labels={labels}
              busy={busy}
              load={() => loadLabels(true)}
              selected={selected}
              setSelected={setSelected}
              labelForm={labelForm}
              setLabelForm={setLabelForm}
              editing={editing}
              setEditing={setEditing}
              saveLabel={saveLabel}
              deleteLabels={deleteLabels}
              prefix={prefix}
              setPrefix={setPrefix}
              weeklyLabels={weeklyLabels}
              createWeekly={createWeekly}
              weeklyProgress={weeklyProgress}
            />
          )}
        </Box>
      </Box>
      {notice && (
        <Box
          position="fixed"
          zIndex="toast"
          bottom="5"
          right="5"
          w={{ base: "calc(100% - 40px)", md: "440px" }}
        >
          <Alert
            className={`notice ${notice.kind}`}
            status={
              notice.kind === "error"
                ? "error"
                : notice.kind === "success"
                  ? "success"
                  : "info"
            }
            borderRadius="xl"
            boxShadow="xl"
            alignItems="flex-start"
          >
            <AlertIcon mt="1" />
            <Box flex="1">
              <AlertDescription>{notice.message}</AlertDescription>
            </Box>
            <IconButton
              size="xs"
              aria-label="Tutup notifikasi"
              icon={<CloseIcon boxSize="2.5" />}
              variant="ghost"
              onClick={() => setNotice(null)}
            />
          </Alert>
        </Box>
      )}
    </Flex>
  );
}

function Login({
  email,
  setEmail,
  password,
  setPassword,
  busy,
  onLogin,
  notice,
  dismiss,
}) {
  return (
    <Flex minH="100vh" align="center" justify="center" px="5" bg="#0d1410">
      <Box w="full" maxW="460px">
        <Flex align="center" justify="center" gap="3" mb="8">
          <Box className="brand-mark">S</Box>
          <Heading size="md">
            Socialchat{" "}
            <Text as="span" color="#18c964">
              Dashboard
            </Text>
          </Heading>
        </Flex>
        <Box {...panel} p={{ base: 7, md: 10 }}>
          <Badge colorScheme="green" borderRadius="full" px="3" py="1">
            LOGIN OPERATOR
          </Badge>
          <Heading mt="5" mb="2" size="xl">
            Selamat datang
          </Heading>
          <Text color="#a7b6ac" mb="7">
            Masuk memakai akun Socialchat untuk mengelola arsip dan label.
          </Text>
          <form onSubmit={onLogin}>
            <Stack spacing="5">
              <FormControl isRequired>
                <FormLabel>Email</FormLabel>
                <Input
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@contoh.com"
                />
              </FormControl>
              <FormControl isRequired>
                <FormLabel>Password</FormLabel>
                <Input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password Socialchat"
                />
              </FormControl>
              <Button
                type="submit"
                colorScheme="green"
                size="lg"
                isLoading={busy}
                loadingText="Menghubungkan"
              >
                Login ke Socialchat
              </Button>
            </Stack>
          </form>
          <Text mt="6" fontSize="xs" color="#91a397">
            Password tidak disimpan. Token sesi berada di sessionStorage tab ini
            dan terhapus saat logout atau tab ditutup.
          </Text>
          {notice && (
            <Alert
              mt="5"
              className={`notice ${notice.kind}`}
              status={notice.kind === "error" ? "error" : "success"}
              borderRadius="lg"
            >
              <AlertIcon />
              <AlertDescription flex="1">{notice.message}</AlertDescription>
              <IconButton
                aria-label="Tutup"
                icon={<CloseIcon boxSize="2.5" />}
                size="xs"
                variant="ghost"
                onClick={dismiss}
              />
            </Alert>
          )}
        </Box>
      </Box>
    </Flex>
  );
}

function PageTitle({ eyebrow, title, description, action, className }) {
  return (
    <Flex
      className={className}
      mb="7"
      align={{ base: "flex-start", md: "flex-end" }}
      justify="space-between"
      direction={{ base: "column", md: "row" }}
      gap="4"
    >
      <Box>
        <Text className="eyebrow">{eyebrow}</Text>
        <Heading mt="2" size="lg">
          {title}
        </Heading>
        <Text mt="2" color="#a7b6ac">
          {description}
        </Text>
      </Box>
      {action}
    </Flex>
  );
}

function Archive({
  fromDate,
  setFromDate,
  toDate,
  setToDate,
  busy,
  onPreview,
  preview,
  confirmation,
  setConfirmation,
  onUnarchive,
  progress,
}) {
  return (
    <>
      <PageTitle
        className="archive-page-title"
        eyebrow="SOSIALCHAT / ARSIP CHAT"
        title="Keluarkan percakapan dari Arsip"
        description="Pilih tanggal, tinjau, lalu proses unarsip."
      />
      <Stack className="archive-layout" spacing="6">
        <Box {...panel} className="archive-range-panel">
          <HStack mb="6">
            <Box className="step-number">01</Box>
            <Box>
              <Heading size="sm">Pilih rentang tanggal</Heading>
              <Text color="#a7b6ac" fontSize="sm">
                Tanggal pesan terakhir · zona waktu Asia/Jakarta · inklusif
              </Text>
            </Box>
          </HStack>
          <Flex
            className="archive-date-fields"
            gap="5"
            direction={{ base: "column", md: "row" }}
            align={{ base: "stretch", md: "flex-end" }}
          >
            <FormControl>
              <FormLabel>Dari tanggal</FormLabel>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </FormControl>
            <FormControl>
              <FormLabel>Sampai tanggal</FormLabel>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </FormControl>
            <Button
              minW={{ md: "220px" }}
              colorScheme="green"
              leftIcon={<SearchIcon />}
              isLoading={busy && !progress}
              onClick={onPreview}
            >
              Pratinjau percakapan
            </Button>
          </Flex>
        </Box>
        {!preview ? (
          <Box
            {...panel}
            className="archive-results empty-results"
            textAlign="center"
            py="16"
          >
            <Box className="empty-symbol">
              <CalendarIcon />
            </Box>
            <Heading size="md" mt="4">
              Siap memeriksa Arsip
            </Heading>
            <Text mt="2" color="#a7b6ac">
              Pilih rentang tanggal lalu tekan Pratinjau percakapan.
            </Text>
          </Box>
        ) : (
          <Box {...panel} className="archive-results">
            <Flex justify="space-between" align="flex-start" mb="6">
              <Box>
                <Text className="eyebrow">HASIL PEMINDAIAN</Text>
                <Heading mt="2" size="md">
                  Pratinjau hasil
                </Heading>
                <Text mt="1" color="#a7b6ac">
                  {preview.fromDate} sampai {preview.toDate} · zona waktu
                  Jakarta
                </Text>
              </Box>
              <Badge colorScheme="green" p="2" borderRadius="lg">
                Siap
              </Badge>
            </Flex>
            <div className="stats-grid">
              <Stat
                title="Akan di-unarsip"
                value={preview.entries.length}
                color="purple"
              />
              <Stat title="Di luar tanggal" value={preview.excludedAfterDate} />
              <Stat title="Tanpa tanggal" value={preview.excludedMissingDate} />
            </div>
            {preview.entries.length > 0 && (
              <Box mt="7" pt="6" borderTop="1px solid #2b3a31">
                <Alert
                  status="warning"
                  bg="#3b2b12"
                  color="#ffe2a8"
                  border="1px solid #73521c"
                  borderRadius="lg"
                  mb="5"
                >
                  <AlertIcon color="#f4c451" />
                  <AlertDescription color="#ffe2a8">
                    Perubahan langsung diterapkan ke akun Socialchat bersama dan
                    terlihat oleh penggunanya.
                  </AlertDescription>
                </Alert>
                <Flex
                  align="flex-end"
                  gap="4"
                  direction={{ base: "column", md: "row" }}
                >
                  <FormControl flex="1">
                    <FormLabel fontSize="sm">
                      Ketik <b>UNARSIP {preview.entries.length}</b> untuk
                      konfirmasi
                    </FormLabel>
                    <Input
                      value={confirmation}
                      onChange={(e) => setConfirmation(e.target.value)}
                      placeholder={`UNARSIP ${preview.entries.length}`}
                    />
                  </FormControl>
                  <Button
                    colorScheme="red"
                    minW={{ md: "220px" }}
                    isLoading={Boolean(progress)}
                    onClick={onUnarchive}
                  >
                    Unarsipkan percakapan
                  </Button>
                </Flex>
              </Box>
            )}
            {progress && (
              <Box mt="6">
                <Flex justify="space-between" mb="2" fontSize="sm">
                  <Text>Proses unarsip</Text>
                  <Text>
                    {progress.done.toLocaleString("id-ID")} /{" "}
                    {progress.total.toLocaleString("id-ID")}
                  </Text>
                </Flex>
                <Box className="progress-track">
                  <Box
                    className="progress-fill"
                    w={`${Math.floor((progress.done / progress.total) * 100)}%`}
                  />
                </Box>
              </Box>
            )}
          </Box>
        )}
      </Stack>
    </>
  );
}
function Stat({ title, value, color }) {
  return (
    <Box className={`stat-card ${color || ""}`}>
      <Text color="#a7b6ac" fontSize="sm">
        {title}
      </Text>
      <Heading size="lg" mt="3">
        {Number(value).toLocaleString("id-ID")}
      </Heading>
      <Text color="#91a397" fontSize="xs" mt="1">
        percakapan
      </Text>
    </Box>
  );
}

function Labels({
  labels,
  busy,
  load,
  selected,
  setSelected,
  labelForm,
  setLabelForm,
  editing,
  setEditing,
  saveLabel,
  deleteLabels,
  prefix,
  setPrefix,
  weeklyLabels,
  createWeekly,
  weeklyProgress,
}) {
  const allSelected =
    labels.filter((item) => item.id).length > 0 &&
    labels
      .filter((item) => item.id)
      .every((item) => selected.includes(item.id));
  const startEdit = (label) => {
    setEditing(label);
    setLabelForm({
      name: label.name || "",
      textColor: label.textColor || "",
      backgroundColor: label.backgroundColor || "",
    });
  };
  const cancelEdit = () => {
    setEditing(null);
    setLabelForm({ name: "", textColor: "#fff", backgroundColor: "#724100" });
  };
  const updateField = (key) => (event) =>
    setLabelForm((current) => ({ ...current, [key]: event.target.value }));
  return (
    <>
      <PageTitle
        eyebrow="SOCIALCHAT / LABEL"
        title="Kelola label"
        description="Perubahan disimpan langsung ke akun Socialchat."
        action={
          <Button colorScheme="green" onClick={load} isLoading={busy}>
            Muat ulang
          </Button>
        }
      />
      <Stack spacing="5">
        <Box className="labels-forms-grid">
          <Box {...panel}>
            <HStack mb="5">
              <Box className="step-number">01</Box>
              <Box>
                <Heading size="sm">
                  {editing ? "Edit label" : "Tambah label"}
                </Heading>
                <Text color="#a7b6ac" fontSize="sm">
                  Buat label atau ubah nama dan warnanya.
                </Text>
              </Box>
            </HStack>
            <form onSubmit={saveLabel}>
              <Flex
                className="label-create-fields"
                gap="4"
                direction={{ base: "column", lg: "row" }}
                align={{ base: "stretch", lg: "flex-end" }}
              >
                <FormControl isRequired flex="2">
                  <FormLabel>Nama label</FormLabel>
                  <Input
                    maxLength={150}
                    value={labelForm.name}
                    onChange={updateField("name")}
                    placeholder="Contoh: Pelanggan VIP"
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>Warna latar</FormLabel>
                  <Input
                    className="color-picker"
                    type="color"
                    aria-label="Pilih warna latar"
                    value={labelForm.backgroundColor}
                    onChange={updateField("backgroundColor")}
                  />
                </FormControl>
                <HStack>
                  <Button
                    type="submit"
                    colorScheme="green"
                    leftIcon={<AddIcon />}
                    isLoading={busy}
                  >
                    {editing ? "Simpan" : "Buat label"}
                  </Button>
                  {editing && (
                    <Button variant="ghost" onClick={cancelEdit}>
                      Batal
                    </Button>
                  )}
                </HStack>
              </Flex>
            </form>
          </Box>
          <Box {...panel}>
            <HStack mb="5">
              <Box className="step-number">02</Box>
              <Box>
                <Heading size="sm">Tambah 8 label mingguan</Heading>
                <Text color="#a7b6ac" fontSize="sm">
                  Nama dan warna mengikuti template; hanya awalan tanggal yang
                  berubah.
                </Text>
              </Box>
            </HStack>
            <form onSubmit={createWeekly}>
              <Flex
                gap="4"
                direction={{ base: "column", md: "row" }}
                align={{ base: "stretch", md: "flex-end" }}
              >
                <FormControl flex="1">
                  <FormLabel>Awalan tanggal</FormLabel>
                  <Input
                    value={prefix}
                    onChange={(e) => setPrefix(e.target.value)}
                    maxLength={100}
                  />
                </FormControl>
                <Button type="submit" colorScheme="green" isLoading={busy}>
                  Buat 8 label
                </Button>
              </Flex>
              <Text mt="4" fontSize="xs" color="#a7b6ac">
                {weeklyProgress ||
                  weeklyLabels.map((item) => item.name).join(" · ")}
              </Text>
            </form>
          </Box>
        </Box>
        <Box {...panel} p={0} overflow="hidden">
          <Flex p="6" align="center" gap="3" wrap="wrap">
            <Box>
              <Heading size="sm">Label Socialchat</Heading>
              <Text fontSize="sm" color="#a7b6ac">
                {labels.length.toLocaleString("id-ID")} label dari Socialchat
              </Text>
            </Box>
            <Spacer />
            <Checkbox
              colorScheme="green"
              isChecked={allSelected}
              isIndeterminate={selected.length > 0 && !allSelected}
              onChange={(e) =>
                setSelected(
                  e.target.checked
                    ? labels.filter((item) => item.id).map((item) => item.id)
                    : [],
                )
              }
            >
              Pilih semua
            </Checkbox>
            <Button
              size="sm"
              colorScheme="red"
              variant="outline"
              leftIcon={<DeleteIcon />}
              isDisabled={!selected.length || busy}
              onClick={() =>
                deleteLabels(
                  labels.filter((item) => selected.includes(item.id)),
                )
              }
            >
              Hapus terpilih{selected.length ? ` (${selected.length})` : ""}
            </Button>
          </Flex>
          <TableContainer maxH="48vh" overflowY="auto">
            <Table size="sm">
              <Thead position="sticky" top="0" bg="#202c25" zIndex="1">
                <Tr>
                  <Th w="10"></Th>
                  <Th>Nama</Th>
                  <Th>Warna latar</Th>
                  <Th>Aksi</Th>
                </Tr>
              </Thead>
              <Tbody>
                {labels.length ? (
                  labels.map((label) => (
                    <Tr key={label.id || label.name}>
                      <Td>
                        <Checkbox
                          colorScheme="green"
                          isChecked={selected.includes(label.id)}
                          isDisabled={!label.id || busy}
                          onChange={(e) =>
                            setSelected(
                              e.target.checked
                                ? [...selected, label.id]
                                : selected.filter((id) => id !== label.id),
                            )
                          }
                        />
                      </Td>
                      <Td fontWeight="700">{label.name || "—"}</Td>
                      <Td>
                        <Badge
                          color={label.textColor || "white"}
                          bg={label.backgroundColor || "gray.400"}
                        >
                          {label.backgroundColor || "—"}
                        </Badge>
                      </Td>
                      <Td>
                        <HStack>
                          <IconButton
                            aria-label="Edit label"
                            size="sm"
                            icon={<EditIcon />}
                            onClick={() => startEdit(label)}
                          />
                          <IconButton
                            aria-label="Hapus label"
                            size="sm"
                            colorScheme="red"
                            variant="ghost"
                            icon={<DeleteIcon />}
                            onClick={() => deleteLabels([label])}
                          />
                        </HStack>
                      </Td>
                    </Tr>
                  ))
                ) : (
                  <Tr>
                    <Td colSpan={4} textAlign="center" py="12" color="#a7b6ac">
                      Belum ada label. Tekan Muat ulang untuk mengambil data
                      Socialchat.
                    </Td>
                  </Tr>
                )}
              </Tbody>
            </Table>
          </TableContainer>
        </Box>
      </Stack>
    </>
  );
}
