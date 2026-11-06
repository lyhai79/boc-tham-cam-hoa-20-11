import { createClient } from "@supabase/supabase-js";
import "./style.css";

// Điền URL và anon key của dự án Supabase vào file .env (xem README).
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const classes = [
  "6A","6B","6C","6D","6E","6G","6H","6I","6K",
  "7A","7B","7C","7D","7E","7G","7H",
  "8A","8B","8C","8D","8E","8G",
  "9A","9B","9C","9D","9E","9G"
];

const $ = (id) => document.getElementById(id);
let supabase = null;
let draws = [];
let isAdmin = false;
let isLocked = false;
let realtimeChannel = null;

function message(text, kind = "") {
  $("message").textContent = text;
  $("message").className = `message ${kind}`;
}
function showSetupError(text) {
  $("setup-warning").textContent = text;
  $("setup-warning").classList.remove("hidden");
  $("draw-button").disabled = true;
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}
function updateSelect() {
  const used = new Set(draws.map(d => d.class_name));
  const current = $("class-select").value;
  $("class-select").innerHTML = '<option value="">-- Chọn lớp của bạn --</option>' +
    classes.map(c => `<option value="${c}" ${used.has(c) ? "disabled" : ""}>Lớp ${c}${used.has(c) ? " — đã bốc thăm" : ""}</option>`).join("");
  if (current && !used.has(current)) $("class-select").value = current;
  $("draw-button").disabled = isLocked || draws.length >= 28 || !supabase;
}
function render() {
  const sorted = [...draws].sort((a,b) => a.draw_number - b.draw_number);
  const count = sorted.length;
  $("drawn-count").textContent = count;
  $("remaining-count").textContent = 28 - count;
  $("progress-text").textContent = `${Math.round(count / 28 * 100)}%`;
  $("progress-bar").style.width = `${count / 28 * 100}%`;
  $("results-body").innerHTML = sorted.length ? sorted.map(d => `
    <tr>
      <td><b>${String(d.draw_number).padStart(2,"0")}</b></td>
      <td><b>${escapeHtml(d.class_name)}</b></td>
      <td><span class="status-done">Đã bốc thăm</span></td>
      <td>${d.created_at ? new Date(d.created_at).toLocaleString("vi-VN") : "—"}</td>
    </tr>`).join("") : '<tr><td colspan="4" class="empty">Chưa có lớp nào bốc thăm.</td></tr>';
  updateSelect();
  if (isLocked) {
    $("draw-button").disabled = true;
    $("draw-button").textContent = "HỆ THỐNG ĐANG KHÓA";
  } else if (count >= 28) {
    $("draw-button").disabled = true;
    $("draw-button").textContent = "ĐÃ HOÀN THÀNH 28/28 LỚP";
  } else {
    $("draw-button").textContent = "🎟 BỐC THĂM NGAY";
  }
}
async function loadState() {
  const [{data: drawData, error: drawError}, {data: settings, error: settingsError}] = await Promise.all([
    supabase.from("draws").select("*"),
    supabase.from("app_settings").select("is_locked").eq("id", 1).single()
  ]);
  if (drawError) throw drawError;
  if (settingsError) throw settingsError;
  draws = drawData || [];
  isLocked = !!settings.is_locked;
  render();
}
function subscribeRealtime() {
  if (realtimeChannel) supabase.removeChannel(realtimeChannel);
  realtimeChannel = supabase.channel("public-draw-updates")
    .on("postgres_changes", {event:"*", schema:"public", table:"draws"}, async () => {
      await loadState();
    })
    .on("postgres_changes", {event:"UPDATE", schema:"public", table:"app_settings"}, async () => {
      await loadState();
    })
    .subscribe();
}
async function drawOnce() {
  const className = $("class-select").value;
  const code = $("class-code").value.trim();
  if (!className) return message("Vui lòng chọn lớp trước khi bốc thăm.", "error");
  if (!code) return message("Vui lòng nhập mã bốc thăm do Ban tổ chức cấp.", "error");
  if (draws.some(d => d.class_name === className)) return message("Lớp này đã bốc thăm. Không thể bốc thăm lần thứ hai.", "error");
  $("draw-button").disabled = true;
  $("draw-button").textContent = "ĐANG BỐC THĂM…";
  message("Hệ thống đang xác nhận và chọn số thứ tự…");
  const {data, error} = await supabase.rpc("draw_once", {
    p_class_name: className,
    p_access_code: code
  });
  $("class-code").value = "";
  if (error) {
    message(error.message || "Không thể thực hiện bốc thăm. Vui lòng liên hệ Ban tổ chức.", "error");
    await loadState();
    return;
  }
  const result = Array.isArray(data) ? data[0] : data;
  if (!result) {
    message("Không nhận được kết quả. Vui lòng tải lại dữ liệu.", "error");
    await loadState();
    return;
  }
  $("result-class").textContent = `LỚP ${result.class_name}`;
  $("result-number").textContent = `SỐ ${String(result.draw_number).padStart(2,"0")}`;
  $("result-card").classList.remove("hidden");
  message(`Chúc mừng lớp ${result.class_name}! Kết quả đã được ghi nhận.`, "success");
  await loadState();
}
async function loginAdmin() {
  const email = $("admin-email").value.trim();
  const password = $("admin-password").value;
  const {error} = await supabase.auth.signInWithPassword({email, password});
  if (error) return message("Đăng nhập không thành công: " + error.message, "error");
  const {data: profile, error: profileError} = await supabase.from("profiles").select("role").single();
  if (profileError || profile?.role !== "admin") {
    await supabase.auth.signOut();
    return message("Tài khoản này chưa được cấp quyền quản trị.", "error");
  }
  isAdmin = true;
  $("admin-login").classList.add("hidden");
  $("admin-controls").classList.remove("hidden");
  message("Đăng nhập quản trị thành công.", "success");
}
async function setLock() {
  const next = !isLocked;
  const {error} = await supabase.rpc("admin_set_lock", {p_locked: next});
  if (error) return message("Không thể thay đổi trạng thái: " + error.message, "error");
  message(next ? "Đã khóa hệ thống bốc thăm." : "Đã mở khóa hệ thống.", "success");
  await loadState();
  $("lock-button").textContent = isLocked ? "Mở hệ thống bốc thăm" : "Khóa hệ thống bốc thăm";
}
async function resetDraws() {
  const ok = confirm("CẢNH BÁO: Bạn có chắc chắn muốn xóa toàn bộ kết quả bốc thăm của 28 lớp? Thao tác này không thể hoàn tác.");
  if (!ok) return;
  const {error} = await supabase.rpc("admin_reset_draws");
  if (error) return message("Không thể đặt lại: " + error.message, "error");
  $("result-card").classList.add("hidden");
  message("Đã đặt lại toàn bộ kết quả theo yêu cầu quản trị.", "success");
  await loadState();
}
function exportCsv() {
  const sorted = [...draws].sort((a,b) => a.draw_number - b.draw_number);
  const rows = [["STT","Lớp","Trạng thái","Thời điểm"], ...sorted.map(d => [
    String(d.draw_number).padStart(2,"0"), d.class_name, "Đã bốc thăm",
    d.created_at ? new Date(d.created_at).toLocaleString("vi-VN") : ""
  ])];
  const csv = "\uFEFF" + rows.map(r => r.map(v => `"${String(v).replaceAll('"','""')}"`).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], {type:"text/csv;charset=utf-8"}));
  const a = document.createElement("a"); a.href = url; a.download = "ket-qua-boc-tham-cam-hoa-20-11.csv"; a.click();
  URL.revokeObjectURL(url);
}

$("draw-button").addEventListener("click", drawOnce);
$("admin-toggle").addEventListener("click", () => $("admin-box").classList.toggle("hidden"));
$("login-button").addEventListener("click", loginAdmin);
$("lock-button").addEventListener("click", setLock);
$("reset-button").addEventListener("click", resetDraws);
$("logout-button").addEventListener("click", async () => {
  await supabase.auth.signOut();
  isAdmin = false;
  $("admin-controls").classList.add("hidden");
  $("admin-login").classList.remove("hidden");
  message("Đã đăng xuất.", "success");
});
$("export-button").addEventListener("click", exportCsv);
$("print-button").addEventListener("click", () => window.print());

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  showSetupError("Ứng dụng chưa được kết nối Supabase. Quản trị viên cần cấu hình VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY theo hướng dẫn trong README.");
} else {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  loadState().then(subscribeRealtime).catch(err => showSetupError("Không tải được dữ liệu: " + err.message));
  supabase.auth.onAuthStateChange(() => {});
}
