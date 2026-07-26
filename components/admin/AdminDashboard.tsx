"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { ChangeEvent, ReactNode, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BedDouble,
  CalendarCheck,
  Clock3,
  ClipboardList,
  Copy,
  CreditCard,
  FileText,
  GalleryHorizontal,
  Hotel,
  ImageIcon,
  Inbox,
  KeyRound,
  ListChecks,
  LogOut,
  Mail,
  Pencil,
  PhoneCall,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings,
  Trash2,
  Upload,
  Users
} from "lucide-react";
import {
  calculateNights,
  formatBookingCurrency,
  getGuestCount,
  getRoomAvailability,
  getRoomCapacityLimit,
  parseRoomPrice
} from "@/lib/booking";
import type { PaymentStatus, ReservationRequest, ReservationStatus } from "@/lib/reservation-schema";
import type { AdminImage, GalleryItem, Room, RoomFeature, SiteContent } from "@/lib/site-content-schema";

type AdminDashboardProps = {
  initialContent: SiteContent;
  initialImages: AdminImage[];
  initialReservations: ReservationRequest[];
};

type AdminTab =
  | "dashboard"
  | "rooms"
  | "reservations"
  | "payments"
  | "guests"
  | "inbox"
  | "history"
  | "content"
  | "gallery"
  | "services"
  | "images"
  | "settings";

type AdminReservationDraft = {
  checkIn: string;
  checkOut: string;
  roomSlug: string;
  adults: number;
  children: number;
  name: string;
  phone: string;
  email: string;
  note: string;
  adminNote: string;
  pricePerNight: number;
  status: ReservationStatus;
};

type ReservationMode = "list" | "new" | "edit";
type ReservationColumn = "guest" | "room" | "dates" | "guests" | "status" | "payment" | "total" | "source" | "actions";

type GuestProfile = {
  key: string;
  name: string;
  phone: string;
  email: string;
  reservationCount: number;
  confirmedCount: number;
  totalSpend: number;
  lastActivity: string;
  roomTitles: string[];
  isComplete: boolean;
};

const tabs: Array<{ id: AdminTab; label: string; icon: ReactNode }> = [
  { id: "dashboard", label: "Panel", icon: <ClipboardList size={18} /> },
  { id: "rooms", label: "Odalar", icon: <BedDouble size={18} /> },
  { id: "reservations", label: "Rezervasyonlar", icon: <CalendarCheck size={18} /> },
  { id: "payments", label: "Ödemeler", icon: <CreditCard size={18} /> },
  { id: "guests", label: "Misafirler", icon: <Users size={18} /> },
  { id: "inbox", label: "Gelen Kutusu", icon: <Inbox size={18} /> },
  { id: "history", label: "Hareketler", icon: <Clock3 size={18} /> },
  { id: "content", label: "Site İçeriği", icon: <FileText size={18} /> },
  { id: "gallery", label: "Galeri", icon: <GalleryHorizontal size={18} /> },
  { id: "services", label: "Hizmetler", icon: <ListChecks size={18} /> },
  { id: "images", label: "Medya", icon: <ImageIcon size={18} /> },
  { id: "settings", label: "Ayarlar", icon: <Settings size={18} /> }
];

function replaceItem<T>(items: T[], index: number, item: T) {
  return items.map((current, currentIndex) => (currentIndex === index ? item : current));
}

function moveItem<T>(items: T[], index: number, direction: -1 | 1) {
  const nextIndex = index + direction;

  if (nextIndex < 0 || nextIndex >= items.length) {
    return items;
  }

  const next = [...items];
  const [item] = next.splice(index, 1);
  next.splice(nextIndex, 0, item);
  return next;
}

function slugify(input: string) {
  return input
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateLabel(value: string) {
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

function formatDateTimeLabel(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short"
  }).format(date);
}

function getGuestProfileKey(reservation: ReservationRequest) {
  const email = reservation.email?.trim().toLocaleLowerCase("tr-TR");
  const phone = reservation.phone.replace(/\D/g, "");
  const name = reservation.name.trim().toLocaleLowerCase("tr-TR");
  return email || phone || name || reservation.id;
}

function buildGuestProfiles(reservations: ReservationRequest[]) {
  const profiles = new Map<string, GuestProfile>();

  reservations.forEach((reservation) => {
    const key = getGuestProfileKey(reservation);
    const existing = profiles.get(key);
    const rooms = new Set(existing?.roomTitles ?? []);
    rooms.add(reservation.roomTitle);

    profiles.set(key, {
      key,
      name: existing?.name || reservation.name,
      phone: existing?.phone || reservation.phone,
      email: existing?.email || reservation.email || "",
      reservationCount: (existing?.reservationCount ?? 0) + 1,
      confirmedCount: (existing?.confirmedCount ?? 0) + (reservation.status === "confirmed" ? 1 : 0),
      totalSpend: (existing?.totalSpend ?? 0) + (reservation.status === "cancelled" ? 0 : reservation.estimatedTotal),
      lastActivity:
        existing && existing.lastActivity > reservation.updatedAt ? existing.lastActivity : reservation.updatedAt,
      roomTitles: Array.from(rooms),
      isComplete: Boolean((existing?.email || reservation.email) && (existing?.phone || reservation.phone))
    });
  });

  return Array.from(profiles.values()).sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));
}

function getStatusTone(status: ReservationStatus) {
  if (status === "confirmed") return "success";
  if (status === "cancelled") return "danger";
  if (status === "archived") return "muted";
  if (status === "contacted") return "warning";
  return "info";
}

const reservationStatusLabels: Record<ReservationStatus, string> = {
  new: "Yeni",
  contacted: "Görüşüldü",
  confirmed: "Onaylandı",
  cancelled: "İptal",
  archived: "Arşiv"
};

const paymentStatusLabels: Record<PaymentStatus, string> = {
  not_required: "Ödeme yok",
  pending: "Ödeme bekliyor",
  processing: "Ödeme ekranında",
  paid: "Ödendi",
  failed: "Başarısız",
  cancelled: "İptal",
  refunded: "İade"
};

const reservationColumnLabels: Record<ReservationColumn, string> = {
  actions: "İşlem",
  dates: "Tarih",
  guest: "Misafir",
  guests: "Kişi",
  payment: "Ödeme",
  room: "Oda",
  source: "Kaynak",
  status: "Durum",
  total: "Tutar"
};

const defaultReservationColumns: Record<ReservationColumn, boolean> = {
  actions: true,
  dates: true,
  guest: true,
  guests: true,
  payment: true,
  room: true,
  source: true,
  status: true,
  total: true
};

function getPaymentTone(status: PaymentStatus) {
  if (status === "paid") return "success";
  if (status === "failed" || status === "cancelled") return "danger";
  if (status === "processing" || status === "pending") return "warning";
  if (status === "refunded") return "info";
  return "muted";
}

const MAX_CLIENT_UPLOAD_SIZE = 10 * 1024 * 1024;
const acceptedUploadTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

function isUploadedImagePath(src: string) {
  return src.startsWith("/uploads/") && src.endsWith(".webp");
}

function validateImageFile(file: File) {
  if (!acceptedUploadTypes.has(file.type)) {
    throw new Error("Sadece JPG, PNG, AVIF veya WebP görsel yüklenebilir.");
  }

  if (file.size <= 0) {
    throw new Error("Görsel dosyası boş.");
  }

  if (file.size > MAX_CLIENT_UPLOAD_SIZE) {
    throw new Error("Görsel 10 MB sınırını geçmemeli.");
  }
}

function formatDateOnly(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function today() {
  return formatDateOnly(new Date());
}

function addDays(dateValue: string, days: number) {
  const date = new Date(`${dateValue}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  date.setDate(date.getDate() + days);
  return formatDateOnly(date);
}

function getRoomPricePerNight(rooms: Room[], roomSlug: string) {
  const room = rooms.find((item) => item.slug === roomSlug);
  return room ? parseRoomPrice(room.price) : 0;
}

function createReservationDraft(rooms: Room[]): AdminReservationDraft {
  const checkIn = today();
  const roomSlug = rooms[0]?.slug ?? "";

  return {
    checkIn,
    checkOut: addDays(checkIn, 1),
    roomSlug,
    adults: 2,
    children: 0,
    name: "",
    phone: "",
    email: "",
    note: "",
    adminNote: "",
    pricePerNight: getRoomPricePerNight(rooms, roomSlug),
    status: "confirmed"
  };
}

type ReservationPreviewInput = Pick<
  AdminReservationDraft | ReservationRequest,
  "adults" | "checkIn" | "checkOut" | "children" | "roomSlug" | "status"
> & {
  pricePerNight?: number;
};

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

function constrainReservationGuests<T extends { adults: number; children: number; roomSlug: string }>(input: T, rooms: Room[]): T {
  const room = rooms.find((item) => item.slug === input.roomSlug);

  if (!room) {
    return input;
  }

  const capacityLimit = Math.max(getRoomCapacityLimit(room), 1);
  const adults = clampNumber(input.adults, 1, capacityLimit);
  const children = clampNumber(input.children, 0, Math.max(capacityLimit - adults, 0));
  return { ...input, adults, children };
}

function getReservationManualPricing(input: ReservationPreviewInput, rooms: Room[]) {
  const nights = calculateNights(input.checkIn, input.checkOut);
  const pricePerNight = Number.isFinite(input.pricePerNight)
    ? Math.max(0, Math.round(input.pricePerNight ?? 0))
    : getRoomPricePerNight(rooms, input.roomSlug);

  return {
    estimatedTotal: nights * pricePerNight,
    nights,
    pricePerNight
  };
}

function reservationHasStarted(reservation: ReservationRequest) {
  return reservation.status === "confirmed" && reservation.checkIn <= today();
}

function getReservationPreview({
  excludeReservationId,
  input,
  reservations,
  rooms
}: {
  excludeReservationId?: string;
  input: ReservationPreviewInput;
  reservations: ReservationRequest[];
  rooms: Room[];
}) {
  const room = rooms.find((item) => item.slug === input.roomSlug);

  if (!room) {
    return {
      availability: null,
      capacityLimit: 0,
      error: "Oda bulunamadı.",
      guestCount: getGuestCount(input.adults, input.children),
      pricing: getReservationManualPricing(input, rooms),
      room: null
    };
  }

  const capacityLimit = getRoomCapacityLimit(room);
  const guestCount = getGuestCount(input.adults, input.children);
  const availability = getRoomAvailability(room, reservations, input.checkIn, input.checkOut, excludeReservationId);
  const pricing = getReservationManualPricing(input, rooms);
  const dateError = !input.checkIn || !input.checkOut || input.checkOut <= input.checkIn ? "Çıkış tarihi girişten sonra olmalı." : "";
  const occupancyError =
    guestCount > capacityLimit ? `${room.title} için en fazla ${capacityLimit} misafir seçilebilir.` : "";
  const availabilityError =
    !dateError && input.status === "confirmed" && !availability.isAvailable
      ? "Onaylı kayıt için bu tarih aralığında müsait oda yok."
      : "";

  return {
    availability,
    capacityLimit,
    error: dateError || occupancyError || availabilityError,
    guestCount,
    pricing,
    room
  };
}

export function AdminDashboard({ initialContent, initialImages, initialReservations }: AdminDashboardProps) {
  const router = useRouter();
  const [content, setContent] = useState(initialContent);
  const [images, setImages] = useState(initialImages);
  const [reservations, setReservations] = useState(initialReservations);
  const [newReservation, setNewReservation] = useState<AdminReservationDraft>(() => createReservationDraft(initialContent.rooms));
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
  const [selectedRoomIndex, setSelectedRoomIndex] = useState(0);
  const [roomSearch, setRoomSearch] = useState("");
  const [reservationSearch, setReservationSearch] = useState("");
  const [reservationStatusFilter, setReservationStatusFilter] = useState<"all" | ReservationStatus>("all");
  const [reservationMode, setReservationMode] = useState<ReservationMode>("list");
  const [editingReservationId, setEditingReservationId] = useState<string | null>(null);
  const [reservationColumns, setReservationColumns] = useState(defaultReservationColumns);
  const [paymentSearch, setPaymentSearch] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<"all" | PaymentStatus>("all");
  const [paymentNotes, setPaymentNotes] = useState<Record<string, string>>({});
  const [guestSearch, setGuestSearch] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingImageSrc, setDeletingImageSrc] = useState<string | null>(null);
  const [isCreatingReservation, setIsCreatingReservation] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [updatingReservationId, setUpdatingReservationId] = useState<string | null>(null);
  const [updatingPaymentId, setUpdatingPaymentId] = useState<string | null>(null);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });

  const selectedRoom = content.rooms[Math.min(selectedRoomIndex, content.rooms.length - 1)];
  const guestProfiles = useMemo(() => buildGuestProfiles(reservations), [reservations]);
  const activeReservations = useMemo(
    () => reservations.filter((reservation) => reservation.status !== "archived"),
    [reservations]
  );
  const inboxReservations = useMemo(
    () =>
      reservations.filter(
        (reservation) => reservation.source === "website" && ["new", "contacted"].includes(reservation.status)
      ),
    [reservations]
  );
  const dashboardMetrics = useMemo(() => {
    const confirmedReservations = reservations.filter((reservation) => reservation.status === "confirmed");
    const cancelledReservations = reservations.filter((reservation) => reservation.status === "cancelled");
    const confirmedRevenue = confirmedReservations.reduce((sum, reservation) => sum + reservation.estimatedTotal, 0);
    const paidRevenue = reservations
      .filter((reservation) => reservation.paymentStatus === "paid")
      .reduce((sum, reservation) => sum + (reservation.paymentAmount || reservation.estimatedTotal), 0);
    const totalRoomInventory = content.rooms.reduce((sum, room) => sum + room.count, 0);
    const bookedRoomNights = confirmedReservations.reduce((sum, reservation) => sum + reservation.nights, 0);
    const averageStay = confirmedReservations.length ? Math.round(bookedRoomNights / confirmedReservations.length) : 0;

    return {
      averageStay,
      bookedRoomNights,
      cancelledReservations: cancelledReservations.length,
      confirmedReservations: confirmedReservations.length,
      confirmedRevenue,
      failedPayments: reservations.filter((reservation) => reservation.paymentStatus === "failed").length,
      newRequests: reservations.filter((reservation) => reservation.status === "new").length,
      paidPayments: reservations.filter((reservation) => reservation.paymentStatus === "paid").length,
      paidRevenue,
      pendingPayments: reservations.filter((reservation) => ["pending", "processing"].includes(reservation.paymentStatus)).length,
      totalRoomInventory
    };
  }, [content.rooms, reservations]);
  const stats = useMemo(() => {
    return [
      { label: "Toplam oda", value: dashboardMetrics.totalRoomInventory },
      { label: "Yeni talep", value: dashboardMetrics.newRequests },
      { label: "Onaylı", value: dashboardMetrics.confirmedReservations },
      { label: "Tahmini gelir", value: formatBookingCurrency(dashboardMetrics.confirmedRevenue) },
      { label: "Ödenen", value: formatBookingCurrency(dashboardMetrics.paidRevenue) },
      { label: "Ödeme bekleyen", value: dashboardMetrics.pendingPayments },
      { label: "Misafir", value: guestProfiles.length }
    ];
  }, [content.rooms.length, dashboardMetrics, guestProfiles.length]);

  function flash(type: "success" | "error", text: string) {
    setMessageType(type);
    setMessage(text);
  }

  function handleUnauthorized(response: Response) {
    if (response.status !== 401) {
      return false;
    }

    flash("error", "Oturum süresi doldu. Lütfen tekrar giriş yapın.");
    router.replace("/admin/login");
    router.refresh();
    return true;
  }

  async function saveContent() {
    setIsSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(content)
      });
      const result = (await response.json().catch(() => ({}))) as {
        content?: SiteContent;
        error?: string;
        issues?: Array<{ path: string; message: string }>;
      };

      if (handleUnauthorized(response)) return;

      if (!response.ok || !result.content) {
        const issue = result.issues?.[0];
        flash("error", issue ? `${issue.path}: ${issue.message}` : result.error ?? "İçerik kaydedilemedi.");
        return;
      }

      setContent(result.content);
      flash("success", "Kaydedildi. Önceki içerik backup'a alındı.");
      router.refresh();
    } catch {
      flash("error", "İçerik kaydedilemedi. Bağlantıyı kontrol edip tekrar deneyin.");
    } finally {
      setIsSaving(false);
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }

  async function uploadImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    setIsUploading(true);
    setMessage("");

    try {
      const image = await uploadAdminImage(file);
      addImageToLibrary(image);
      flash("success", `${image.src} yüklendi.`);
    } catch (error) {
      flash("error", error instanceof Error ? error.message : "Görsel yüklenemedi.");
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  }

  async function uploadAdminImage(file: File) {
    validateImageFile(file);

    const formData = new FormData();
    formData.set("file", file);

    const response = await fetch("/api/admin/images", {
      method: "POST",
      body: formData
    });
    const result = (await response.json().catch(() => ({}))) as { image?: AdminImage; error?: string };

    if (handleUnauthorized(response)) {
      throw new Error("Oturum süresi doldu.");
    }

    if (!response.ok || !result.image) {
      throw new Error(result.error ?? "Görsel yüklenemedi.");
    }

    return result.image;
  }

  function addImageToLibrary(image: AdminImage) {
    setImages((current) =>
      [...current.filter((item) => item.src !== image.src), image].sort((a, b) => a.src.localeCompare(b.src))
    );
  }

  function getImageUsageCount(src: string, candidateContent: SiteContent = content) {
    if (!src) return 0;

    let count = 0;
    const track = (value: string) => {
      if (value === src) count += 1;
    };

    track(candidateContent.pages.home.heroImage);
    track(candidateContent.pages.home.historyImage);
    track(candidateContent.pages.history.image);
    candidateContent.galleryItems.forEach((item) => track(item.image));
    candidateContent.rooms.forEach((room) => {
      track(room.image);
      room.gallery.forEach(track);
    });

    return count;
  }

  async function deleteImage(image: AdminImage) {
    if (!isUploadedImagePath(image.src)) {
      flash("error", "Bu görsel proje görseli. Kalıcı silinmez; ilgili alandan başka görsel seçebilirsin.");
      return;
    }

    const usageCount = getImageUsageCount(image.src);

    if (usageCount > 0) {
      flash("error", `Bu görsel ${usageCount} yerde kullanılıyor. Önce ilgili alanlardan kaldır veya başka görselle değiştir.`);
      return;
    }

    if (!window.confirm(`${image.name} kalıcı olarak silinsin mi?`)) return;

    setDeletingImageSrc(image.src);
    setMessage("");

    try {
      const response = await fetch("/api/admin/images", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ src: image.src })
      });
      const result = (await response.json().catch(() => ({}))) as { images?: AdminImage[]; error?: string };

      if (handleUnauthorized(response)) return;

      if (!response.ok) {
        if (response.status === 409) {
          flash("error", "Bu görsel kayıtlı içerikte kullanılıyor. Önce ilgili alanı değiştirip Kaydet, sonra tekrar sil.");
          return;
        }

        flash("error", result.error ?? "Görsel silinemedi.");
        return;
      }

      setImages((current) => result.images ?? current.filter((item) => item.src !== image.src));
      flash("success", `${image.src} silindi.`);
    } catch {
      flash("error", "Görsel silinemedi. Bağlantıyı kontrol edip tekrar deneyin.");
    } finally {
      setDeletingImageSrc(null);
    }
  }

  async function uploadAndSelectImage(file: File) {
    try {
      const image = await uploadAdminImage(file);
      addImageToLibrary(image);
      flash("success", `${image.src} yüklendi ve seçildi.`);
      return image.src;
    } catch (error) {
      flash("error", error instanceof Error ? error.message : "Görsel yüklenemedi.");
      throw error;
    }
  }

  async function refreshReservations() {
    try {
      const response = await fetch("/api/admin/reservations");
      const result = (await response.json().catch(() => ({}))) as {
        reservations?: ReservationRequest[];
        error?: string;
      };

      if (handleUnauthorized(response)) return;

      if (!response.ok || !result.reservations) {
        flash("error", result.error ?? "Rezervasyon talepleri alınamadı.");
        return;
      }

      setReservations(result.reservations);
      flash("success", "Rezervasyon talepleri yenilendi.");
    } catch {
      flash("error", "Rezervasyon talepleri alınamadı. Bağlantıyı kontrol edin.");
    }
  }

  function updateNewReservationField<K extends keyof AdminReservationDraft>(field: K, value: AdminReservationDraft[K]) {
    setNewReservation((current) => {
      const next = { ...current, [field]: value };

      if (field === "checkIn" && typeof value === "string" && value && next.checkOut <= value) {
        next.checkOut = addDays(value, 1);
      }

      if (field === "roomSlug" && typeof value === "string") {
        next.pricePerNight = getRoomPricePerNight(content.rooms, value);
      }

      return constrainReservationGuests(next, content.rooms);
    });
  }

  function selectGuestForNewReservation(guestKey: string) {
    const guest = guestProfiles.find((item) => item.key === guestKey);

    if (!guest) return;

    setNewReservation((current) => ({
      ...current,
      email: guest.email,
      name: guest.name,
      phone: guest.phone
    }));
  }

  function openNewReservationForm() {
    setEditingReservationId(null);
    setReservationMode("new");
  }

  function openReservationEditor(id: string) {
    setEditingReservationId(id);
    setReservationMode("edit");
  }

  function closeReservationEditor() {
    setEditingReservationId(null);
    setReservationMode("list");
  }

  function toggleReservationColumn(column: ReservationColumn) {
    setReservationColumns((current) => ({
      ...current,
      [column]: !current[column]
    }));
  }

  function updatePasswordField(field: keyof typeof passwordForm, value: string) {
    setPasswordForm((current) => ({ ...current, [field]: value }));
  }

  async function changePassword() {
    setMessage("");

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      flash("error", "Yeni şifreler eşleşmiyor.");
      return;
    }

    setIsChangingPassword(true);

    try {
      const response = await fetch("/api/admin/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword
        })
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };

      if (handleUnauthorized(response)) return;

      if (!response.ok) {
        flash("error", result.error ?? "Şifre değiştirilemedi.");
        return;
      }

      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
      });
      flash("success", "Panel şifresi değiştirildi.");
    } catch {
      flash("error", "Şifre değiştirilemedi. Bağlantıyı kontrol edip tekrar deneyin.");
    } finally {
      setIsChangingPassword(false);
    }
  }

  async function createReservation() {
    setIsCreatingReservation(true);
    try {
      const response = await fetch("/api/admin/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newReservation)
      });
      const result = (await response.json().catch(() => ({}))) as {
        reservation?: ReservationRequest;
        error?: string;
      };

      if (handleUnauthorized(response)) return;

      if (!response.ok || !result.reservation) {
        flash("error", result.error ?? "Rezervasyon oluşturulamadı.");
        return;
      }

      setReservations((current) => [result.reservation!, ...current]);
      setNewReservation((current) => ({
        ...createReservationDraft(content.rooms),
        checkIn: current.checkIn,
        checkOut: current.checkOut,
        pricePerNight: getRoomPricePerNight(content.rooms, current.roomSlug),
        roomSlug: current.roomSlug
      }));
      setReservationMode("list");
      flash("success", "Rezervasyon oluşturuldu.");
    } catch {
      flash("error", "Rezervasyon oluşturulamadı. Bağlantıyı kontrol edin.");
    } finally {
      setIsCreatingReservation(false);
    }
  }

  async function submitReservationUpdate(reservation: ReservationRequest) {
    setUpdatingReservationId(reservation.id);
    try {
      const response = await fetch("/api/admin/reservations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: reservation.id,
          adults: reservation.adults,
          checkIn: reservation.checkIn,
          checkOut: reservation.checkOut,
          children: reservation.children,
          email: reservation.email ?? "",
          name: reservation.name,
          note: reservation.note ?? "",
          pricePerNight: reservation.pricePerNight,
          roomSlug: reservation.roomSlug,
          status: reservation.status,
          phone: reservation.phone,
          adminNote: reservation.adminNote ?? ""
        })
      });
      const result = (await response.json().catch(() => ({}))) as {
        reservation?: ReservationRequest;
        error?: string;
      };

      if (handleUnauthorized(response)) return;

      if (!response.ok || !result.reservation) {
        flash("error", result.error ?? "Rezervasyon talebi güncellenemedi.");
        return;
      }

      setReservations((current) => current.map((item) => (item.id === reservation.id ? result.reservation! : item)));
      setReservationMode("list");
      setEditingReservationId(null);
      flash("success", "Rezervasyon güncellendi.");
    } catch {
      flash("error", "Rezervasyon güncellenemedi. Bağlantıyı kontrol edin.");
    } finally {
      setUpdatingReservationId(null);
    }
  }

  async function updateReservation(id: string) {
    const reservation = reservations.find((item) => item.id === id);
    if (!reservation) return;
    await submitReservationUpdate(reservation);
  }

  async function updateReservationStatus(id: string, status: ReservationStatus) {
    const reservation = reservations.find((item) => item.id === id);
    if (!reservation) return;

    const updated = constrainReservationGuests({ ...reservation, status }, content.rooms);
    setReservations((current) => current.map((item) => (item.id === id ? updated : item)));
    await submitReservationUpdate(updated);
  }

  async function updatePaymentStatus(
    id: string,
    action: "mark_paid" | "mark_failed" | "mark_cancelled" | "mark_refunded" | "clear_payment"
  ) {
    const reservation = reservations.find((item) => item.id === id);
    if (!reservation) return;

    setUpdatingPaymentId(id);
    setMessage("");

    try {
      const response = await fetch("/api/admin/payments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          amount: reservation.paymentAmount || reservation.estimatedTotal,
          id,
          note: paymentNotes[id] ?? ""
        })
      });
      const result = (await response.json().catch(() => ({}))) as {
        reservation?: ReservationRequest;
        error?: string;
      };

      if (handleUnauthorized(response)) return;

      if (!response.ok || !result.reservation) {
        flash("error", result.error ?? "Ödeme durumu güncellenemedi.");
        return;
      }

      setReservations((current) => current.map((item) => (item.id === id ? result.reservation! : item)));
      setPaymentNotes((current) => ({ ...current, [id]: "" }));
      flash("success", "Ödeme durumu güncellendi.");
    } catch {
      flash("error", "Ödeme durumu güncellenemedi. Bağlantıyı kontrol edin.");
    } finally {
      setUpdatingPaymentId(null);
    }
  }

  function updateReservationLocal(id: string, patch: Partial<ReservationRequest>) {
    setReservations((current) =>
      current.map((reservation) => {
        if (reservation.id !== id) return reservation;

        const selectedRoom = patch.roomSlug ? content.rooms.find((room) => room.slug === patch.roomSlug) : null;
        const roomPatch = selectedRoom
          ? {
              pricePerNight: parseRoomPrice(selectedRoom.price),
              roomTitle: selectedRoom.title
            }
          : {};

        return constrainReservationGuests({ ...reservation, ...patch, ...roomPatch }, content.rooms);
      })
    );
  }

  function updateSiteField(field: keyof SiteContent["site"], value: string) {
    setContent((current) => ({
      ...current,
      site: { ...current.site, [field]: value }
    }));
  }

  function updateHomeField(field: keyof SiteContent["pages"]["home"], value: string) {
    setContent((current) => ({
      ...current,
      pages: {
        ...current.pages,
        home: { ...current.pages.home, [field]: value }
      }
    }));
  }

  function updateSimplePageField<T extends "rooms" | "gallery">(page: T, field: keyof SiteContent["pages"][T], value: string) {
    setContent((current) => ({
      ...current,
      pages: {
        ...current.pages,
        [page]: { ...current.pages[page], [field]: value }
      }
    }));
  }

  function updateContactPageField(field: keyof SiteContent["pages"]["contact"], value: string) {
    setContent((current) => ({
      ...current,
      pages: {
        ...current.pages,
        contact: { ...current.pages.contact, [field]: value }
      }
    }));
  }

  function updateHistoryPageField(field: Exclude<keyof SiteContent["pages"]["history"], "timeline">, value: string) {
    setContent((current) => ({
      ...current,
      pages: {
        ...current.pages,
        history: { ...current.pages.history, [field]: value }
      }
    }));
  }

  function updateHistoryTimeline(index: number, value: string) {
    setContent((current) => ({
      ...current,
      pages: {
        ...current.pages,
        history: {
          ...current.pages.history,
          timeline: replaceItem(current.pages.history.timeline, index, value)
        }
      }
    }));
  }

  function updateRoom(index: number, room: Room) {
    setContent((current) => ({
      ...current,
      rooms: replaceItem(current.rooms, index, room)
    }));
  }

  function updateRoomField(index: number, field: keyof Room, value: Room[keyof Room]) {
    const room = content.rooms[index];
    if (!room) return;
    updateRoom(index, { ...room, [field]: value } as Room);
  }

  function addRoom() {
    const image = images[0]?.src ?? "/hotel-images/hero-facade-night.webp";
    const roomNumber = content.rooms.length + 1;
    const room: Room = {
      slug: `oda-${roomNumber}`,
      title: `Yeni Oda ${roomNumber}`,
      description: "Kısa oda açıklaması.",
      longDescription: "Odanın detaylı açıklaması.",
      count: 1,
      size: "24 m²",
      capacity: "2 kişiye kadar",
      bed: "Çift kişilik yatak",
      price: "₺0",
      image,
      tone: "room",
      gallery: [image],
      amenities: ["Ücretsiz Wi-Fi"]
    };

    setContent((current) => ({ ...current, rooms: [...current.rooms, room] }));
    setSelectedRoomIndex(content.rooms.length);
  }

  function removeRoom(index: number) {
    if (content.rooms.length <= 1) {
      flash("error", "En az bir oda kalmalı.");
      return;
    }

    if (!window.confirm("Bu oda panel içeriğinden kaldırılacak. Devam edilsin mi?")) return;

    setContent((current) => ({
      ...current,
      rooms: current.rooms.filter((_, currentIndex) => currentIndex !== index)
    }));
    setSelectedRoomIndex(0);
  }

  function updateRoomGallery(roomIndex: number, imageIndex: number, value: string) {
    const room = content.rooms[roomIndex];
    if (!room) return;
    updateRoom(roomIndex, { ...room, gallery: replaceItem(room.gallery, imageIndex, value) });
  }

  function removeRoomGalleryImage(roomIndex: number, imageIndex: number) {
    const room = content.rooms[roomIndex];
    if (!room) return;

    if (room.gallery.length <= 1) {
      flash("error", "Oda galerisinde en az bir görsel kalmalı. Mevcut görseli değiştirebilirsin.");
      return;
    }

    updateRoom(roomIndex, {
      ...room,
      gallery: room.gallery.filter((_, currentIndex) => currentIndex !== imageIndex)
    });
  }

  function updateRoomAmenity(roomIndex: number, amenityIndex: number, value: string) {
    const room = content.rooms[roomIndex];
    if (!room) return;
    updateRoom(roomIndex, { ...room, amenities: replaceItem(room.amenities, amenityIndex, value) });
  }

  function updateGalleryItem(index: number, item: GalleryItem) {
    setContent((current) => ({
      ...current,
      galleryItems: replaceItem(current.galleryItems, index, item)
    }));
  }

  function removeGalleryItem(index: number) {
    if (content.galleryItems.length <= 1) {
      flash("error", "Galeride en az bir görsel kalmalı. Mevcut görseli değiştirebilirsin.");
      return;
    }

    setContent((current) => ({
      ...current,
      galleryItems: current.galleryItems.filter((_, currentIndex) => currentIndex !== index)
    }));
  }

  function updateFeature(index: number, feature: RoomFeature) {
    setContent((current) => ({
      ...current,
      roomFeatures: replaceItem(current.roomFeatures, index, feature)
    }));
  }

  function renderDashboard() {
    const recentReservations = reservations.slice(0, 6);
    const recentActivity = reservations
      .slice()
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 6);

    return (
      <div className="admin-section-stack">
        <section className="admin-dashboard-hero">
          <div>
            <p className="admin-kicker">Otel Yönetim Sistemi</p>
            <h2>{content.site.shortName} operasyon paneli</h2>
            <span>
              Odalar, fiyatlar, rezervasyon talepleri, misafirler ve site içeriği tek panelden yönetiliyor.
            </span>
          </div>
          <div className="admin-dashboard-hero__actions">
            <button className="admin-primary-button" type="button" onClick={() => setActiveTab("reservations")}>
              <Plus size={16} />
              Rezervasyon
            </button>
            <button className="admin-secondary-button" type="button" onClick={() => setActiveTab("rooms")}>
              <BedDouble size={16} />
              Odalar
            </button>
          </div>
        </section>

        <div className="admin-dashboard-grid">
          <section className="admin-panel-section admin-dashboard-card admin-dashboard-card--wide">
            <div className="admin-section-heading">
              <div>
                <h2>Son rezervasyonlar</h2>
                <span>Site ve panel kayıtları</span>
              </div>
              <button className="admin-secondary-button" type="button" onClick={() => setActiveTab("reservations")}>
                Tümünü aç
              </button>
            </div>
            {recentReservations.length ? (
              <div className="admin-data-table">
                <div className="admin-data-table__head admin-data-table__row--reservations">
                  <span>Misafir</span>
                  <span>Oda</span>
                  <span>Tarih</span>
                  <span>Durum</span>
                  <span>Tutar</span>
                </div>
                {recentReservations.map((reservation) => (
                  <div className="admin-data-table__row admin-data-table__row--reservations" key={reservation.id}>
                    <span>
                      <strong>{reservation.name}</strong>
                      <small>{reservation.phone}</small>
                    </span>
                    <span>{reservation.roomTitle}</span>
                    <span>
                      {formatDateLabel(reservation.checkIn)} - {formatDateLabel(reservation.checkOut)}
                    </span>
                    <span>
                      <StatusBadge status={reservation.status} />
                      <PaymentBadge status={reservation.paymentStatus} />
                    </span>
                    <span>{formatBookingCurrency(reservation.estimatedTotal, reservation.currency)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="admin-empty-state">Henüz rezervasyon kaydı yok.</div>
            )}
          </section>

          <section className="admin-panel-section admin-dashboard-card">
            <div className="admin-section-heading">
              <div>
                <h2>Oda doluluğu</h2>
                <span>Onaylı rezervasyonlara göre</span>
              </div>
            </div>
            <div className="admin-occupancy-list">
              {content.rooms.map((room) => {
                const confirmedForRoom = reservations.filter(
                  (reservation) => reservation.roomSlug === room.slug && reservation.status === "confirmed"
                );
                const bookedNights = confirmedForRoom.reduce((sum, reservation) => sum + reservation.nights, 0);
                const fill = Math.min(100, Math.round((bookedNights / Math.max(room.count * 30, 1)) * 100));

                return (
                  <div className="admin-occupancy-item" key={room.slug}>
                    <div>
                      <strong>{room.title}</strong>
                      <span>{room.count} oda / {bookedNights} gece</span>
                    </div>
                    <div className="admin-progress" aria-label={`${room.title} doluluk`}>
                      <span style={{ width: `${fill}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="admin-panel-section admin-dashboard-card">
            <div className="admin-section-heading">
              <div>
                <h2>Gelen Kutusu</h2>
                <span>Yanıt bekleyen web talepleri</span>
              </div>
              <button className="admin-secondary-button" type="button" onClick={() => setActiveTab("inbox")}>
                Aç
              </button>
            </div>
            <div className="admin-activity-list">
              {inboxReservations.slice(0, 5).map((reservation) => (
                <button className="admin-activity-item" key={reservation.id} type="button" onClick={() => setActiveTab("inbox")}>
                  <strong>{reservation.name}</strong>
                  <span>{reservation.roomTitle} · {formatDateLabel(reservation.createdAt)}</span>
                </button>
              ))}
              {inboxReservations.length === 0 ? <div className="admin-empty-state">Bekleyen talep yok.</div> : null}
            </div>
          </section>

          <section className="admin-panel-section admin-dashboard-card">
            <div className="admin-section-heading">
              <div>
                <h2>Aktivite</h2>
                <span>Son güncellemeler</span>
              </div>
              <button className="admin-secondary-button" type="button" onClick={() => setActiveTab("history")}>
                Hareketler
              </button>
            </div>
            <div className="admin-activity-list">
              {recentActivity.map((reservation) => (
                <div className="admin-activity-item" key={reservation.id}>
                  <strong>{reservationStatusLabels[reservation.status]} · {reservation.name}</strong>
                  <span>{formatDateTimeLabel(reservation.updatedAt)}</span>
                </div>
              ))}
              {recentActivity.length === 0 ? <div className="admin-empty-state">Henüz aktivite yok.</div> : null}
            </div>
          </section>
        </div>
      </div>
    );
  }

  function renderContent() {
    return (
      <div className="admin-section-stack">
        <section className="admin-panel-section" data-testid="admin-section-site">
          <div className="admin-section-heading">
            <h2>Otel bilgileri</h2>
            <span>Genel</span>
          </div>
          <div className="admin-form-grid">
            <TextField label="Otel adı" value={content.site.name} onChange={(value) => updateSiteField("name", value)} />
            <TextField
              label="Kısa ad"
              value={content.site.shortName}
              onChange={(value) => updateSiteField("shortName", value)}
            />
            <TextArea
              label="Site açıklaması"
              value={content.site.description}
              onChange={(value) => updateSiteField("description", value)}
            />
            <TextField
              label="Ana site adresi"
              value={content.site.canonicalUrl}
              onChange={(value) => updateSiteField("canonicalUrl", value)}
            />
          </div>
        </section>
        <section className="admin-panel-section" data-testid="admin-section-home-hero">
          <div className="admin-section-heading">
            <h2>Ana sayfa hero</h2>
            <span>İlk ekran</span>
          </div>
          <div className="admin-form-grid">
            <TextField
              label="Başlık"
              value={content.pages.home.heroTitle}
              onChange={(value) => updateHomeField("heroTitle", value)}
            />
            <TextField
              label="Vurgu başlığı"
              value={content.pages.home.heroEmphasis}
              onChange={(value) => updateHomeField("heroEmphasis", value)}
            />
            <TextArea
              label="Kısa metin"
              value={content.pages.home.heroLead}
              onChange={(value) => updateHomeField("heroLead", value)}
            />
            <ImagePicker
              images={images}
              label="Hero görseli"
              onUpload={uploadAndSelectImage}
              testId="image-picker-home-hero"
              value={content.pages.home.heroImage}
              onChange={(value) => updateHomeField("heroImage", value)}
            />
          </div>
        </section>
        <section className="admin-panel-section" data-testid="admin-section-home-history">
          <div className="admin-section-heading">
            <h2>Ana sayfa tarihçe bandı</h2>
            <span>Ön izleme</span>
          </div>
          <div className="admin-form-grid">
            <TextField
              label="Başlık"
              value={content.pages.home.historyTitle}
              onChange={(value) => updateHomeField("historyTitle", value)}
            />
            <TextArea
              label="Metin"
              value={content.pages.home.historyText}
              onChange={(value) => updateHomeField("historyText", value)}
            />
            <ImagePicker
              images={images}
              label="Görsel"
              onUpload={uploadAndSelectImage}
              testId="image-picker-home-history"
              value={content.pages.home.historyImage}
              onChange={(value) => updateHomeField("historyImage", value)}
            />
          </div>
        </section>
      </div>
    );
  }

  function renderReservations() {
    const roomOptions = content.rooms.map((room) => [room.slug, room.title] as [string, string]);
    const guestOptions = [
      ["", "Mevcut misafirden doldur"] as [string, string],
      ...guestProfiles.map((guest) => [
        guest.key,
        `${guest.name} · ${guest.phone}${guest.email ? ` · ${guest.email}` : ""}`
      ] as [string, string])
    ];
    const normalizedSearch = reservationSearch.trim().toLocaleLowerCase("tr-TR");
    const filteredReservations = reservations
      .filter((reservation) => {
        if (reservationStatusFilter !== "all" && reservation.status !== reservationStatusFilter) return false;
        if (!normalizedSearch) return reservation.status !== "archived";

        const haystack = [
          reservation.name,
          reservation.phone,
          reservation.email,
          reservation.roomTitle,
          reservation.checkIn,
          reservation.checkOut,
          reservation.source,
          reservationStatusLabels[reservation.status],
          paymentStatusLabels[reservation.paymentStatus]
        ]
          .join(" ")
          .toLocaleLowerCase("tr-TR");

        return haystack.includes(normalizedSearch);
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const archivedCount = reservations.length - activeReservations.length;
    const editingReservation = editingReservationId
      ? reservations.find((reservation) => reservation.id === editingReservationId) ?? null
      : null;

    function renderBlockedDates(roomSlug: string, excludeReservationId?: string) {
      const blocks = reservations
        .filter((reservation) => reservation.id !== excludeReservationId)
        .filter((reservation) => reservation.roomSlug === roomSlug && reservation.status === "confirmed")
        .sort((a, b) => a.checkIn.localeCompare(b.checkIn));

      return (
        <div className="admin-date-blocks">
          <div>
            <strong>Dolu dönemler</strong>
            <span>Onaylı kayıtlar tarih seçimini etkiler</span>
          </div>
          {blocks.length ? (
            <div className="admin-date-block-list">
              {blocks.slice(0, 6).map((reservation) => (
                <span key={reservation.id}>
                  {formatDateLabel(reservation.checkIn)} - {formatDateLabel(reservation.checkOut)} · {reservation.name}
                </span>
              ))}
              {blocks.length > 6 ? <em>+{blocks.length - 6} kayıt daha</em> : null}
            </div>
          ) : (
            <small>Bu oda için onaylı blokaj yok.</small>
          )}
        </div>
      );
    }

    function renderNewReservationForm() {
      const newReservationPreview = getReservationPreview({
        input: newReservation,
        reservations,
        rooms: content.rooms
      });
      const newReservationMaxChildren = Math.max(newReservationPreview.capacityLimit - newReservation.adults, 0);

      return (
        <div className="admin-reservation-module" data-testid="admin-create-reservation-form">
          <div className="admin-module-heading">
            <button className="admin-secondary-button" type="button" onClick={closeReservationEditor}>
              <ArrowLeft size={16} />
              Listeye dön
            </button>
            <div>
              <p className="admin-kicker">Referans akış</p>
              <h3>Yeni rezervasyon</h3>
              <span>Misafir, oda, tarih, kişi sayısı, gecelik fiyat ve durum tek formda.</span>
            </div>
          </div>
          <div className="admin-form-grid admin-form-grid--reservation">
            <SelectField label="Misafir seç" value="" onChange={selectGuestForNewReservation} options={guestOptions} />
            <SelectField
              label="Oda"
              value={newReservation.roomSlug}
              onChange={(value) => updateNewReservationField("roomSlug", value)}
              options={roomOptions}
            />
            <SelectField
              label="Kayıt durumu"
              value={newReservation.status}
              onChange={(value) => updateNewReservationField("status", value as ReservationStatus)}
              options={Object.entries(reservationStatusLabels)}
            />
            <DateField
              label="Giriş"
              min={today()}
              value={newReservation.checkIn}
              onChange={(value) => updateNewReservationField("checkIn", value)}
            />
            <DateField
              label="Çıkış"
              min={addDays(newReservation.checkIn, 1)}
              value={newReservation.checkOut}
              onChange={(value) => updateNewReservationField("checkOut", value)}
            />
            <NumberField
              label="Gecelik fiyat"
              min={0}
              value={newReservation.pricePerNight}
              onChange={(value) => updateNewReservationField("pricePerNight", value)}
            />
            <NumberField
              label="Yetişkin"
              min={1}
              max={Math.max(newReservationPreview.capacityLimit, 1)}
              value={newReservation.adults}
              onChange={(value) => updateNewReservationField("adults", value)}
            />
            <NumberField
              label="Çocuk"
              min={0}
              max={newReservationMaxChildren}
              value={newReservation.children}
              onChange={(value) => updateNewReservationField("children", value)}
            />
            <TextField label="Ad Soyad" value={newReservation.name} onChange={(value) => updateNewReservationField("name", value)} />
            <TextField label="Telefon" type="tel" value={newReservation.phone} onChange={(value) => updateNewReservationField("phone", value)} />
            <TextField label="E-posta" type="email" value={newReservation.email} onChange={(value) => updateNewReservationField("email", value)} />
            <TextArea label="Misafir notu" value={newReservation.note} onChange={(value) => updateNewReservationField("note", value)} />
            <TextArea label="Panel notu" value={newReservation.adminNote} onChange={(value) => updateNewReservationField("adminNote", value)} />
          </div>
          <div className="admin-reservation-form-side">
            <ReservationAvailabilityPreview preview={newReservationPreview} />
            {renderBlockedDates(newReservation.roomSlug)}
          </div>
          <div className="admin-inline-actions">
            <button
              className="admin-primary-button"
              data-testid="admin-create-reservation"
              disabled={isCreatingReservation || Boolean(newReservationPreview.error)}
              type="button"
              onClick={createReservation}
            >
              <Plus size={16} />
              {isCreatingReservation ? "Oluşturuluyor" : "Rezervasyon Oluştur"}
            </button>
            <button className="admin-secondary-button" type="button" onClick={closeReservationEditor}>
              Vazgeç
            </button>
          </div>
        </div>
      );
    }

    function renderEditReservationForm(reservation: ReservationRequest) {
      const reservationPreview = getReservationPreview({
        excludeReservationId: reservation.id,
        input: reservation,
        reservations,
        rooms: content.rooms
      });
      const reservationMaxChildren = Math.max(reservationPreview.capacityLimit - reservation.adults, 0);
      const lockStartedFields = reservationHasStarted(reservation);

      return (
        <div className="admin-reservation-module" data-testid="admin-edit-reservation-form">
          <div className="admin-module-heading">
            <button className="admin-secondary-button" type="button" onClick={closeReservationEditor}>
              <ArrowLeft size={16} />
              Listeye dön
            </button>
            <div>
              <p className="admin-kicker">Rezervasyon #{reservation.id.slice(0, 8)}</p>
              <h3>{reservation.name}</h3>
              <span>
                {reservation.source === "admin" ? "Panel kaydı" : "Web sitesi kaydı"} ·{" "}
                {formatDateTimeLabel(reservation.createdAt)}
              </span>
            </div>
          </div>
          {lockStartedFields ? (
            <p className="admin-reservation-lock-note">
              Bu onaylı rezervasyon başlamış görünüyor. Oda ve tarih alanları korunur; durum, iletişim ve notlar güncellenebilir.
            </p>
          ) : null}
          <div className="admin-form-grid admin-form-grid--reservation">
            <TextField label="Ad Soyad" value={reservation.name} onChange={(value) => updateReservationLocal(reservation.id, { name: value })} />
            <TextField label="Telefon" type="tel" value={reservation.phone} onChange={(value) => updateReservationLocal(reservation.id, { phone: value })} />
            <TextField label="E-posta" type="email" value={reservation.email ?? ""} onChange={(value) => updateReservationLocal(reservation.id, { email: value })} />
            <SelectField
              disabled={lockStartedFields}
              label="Oda"
              value={reservation.roomSlug}
              onChange={(value) => updateReservationLocal(reservation.id, { roomSlug: value })}
              options={roomOptions}
            />
            <SelectField
              label="Durum"
              value={reservation.status}
              onChange={(value) => updateReservationLocal(reservation.id, { status: value as ReservationStatus })}
              options={Object.entries(reservationStatusLabels)}
            />
            <NumberField
              label="Gecelik fiyat"
              min={0}
              value={reservation.pricePerNight}
              onChange={(value) => updateReservationLocal(reservation.id, { pricePerNight: value })}
            />
            <DateField
              disabled={lockStartedFields}
              label="Giriş"
              min={reservation.checkIn < today() ? reservation.checkIn : today()}
              value={reservation.checkIn}
              onChange={(value) =>
                updateReservationLocal(reservation.id, {
                  checkIn: value,
                  checkOut: reservation.checkOut <= value ? addDays(value, 1) : reservation.checkOut
                })
              }
            />
            <DateField
              disabled={lockStartedFields}
              label="Çıkış"
              min={addDays(reservation.checkIn, 1)}
              value={reservation.checkOut}
              onChange={(value) => updateReservationLocal(reservation.id, { checkOut: value })}
            />
            <NumberField
              disabled={lockStartedFields}
              label="Yetişkin"
              min={1}
              max={Math.max(reservationPreview.capacityLimit, 1)}
              value={reservation.adults}
              onChange={(value) => updateReservationLocal(reservation.id, { adults: value })}
            />
            <NumberField
              disabled={lockStartedFields}
              label="Çocuk"
              min={0}
              max={reservationMaxChildren}
              value={reservation.children}
              onChange={(value) => updateReservationLocal(reservation.id, { children: value })}
            />
            <TextArea
              label="Misafir notu"
              value={reservation.note ?? ""}
              onChange={(value) => updateReservationLocal(reservation.id, { note: value })}
            />
            <TextArea
              label="Panel notu"
              value={reservation.adminNote ?? ""}
              onChange={(value) => updateReservationLocal(reservation.id, { adminNote: value })}
            />
          </div>
          <div className="admin-reservation-form-side">
            <ReservationAvailabilityPreview preview={reservationPreview} />
            {renderBlockedDates(reservation.roomSlug, reservation.id)}
          </div>
          <div className="admin-inline-actions">
            <button
              className="admin-primary-button"
              disabled={updatingReservationId === reservation.id || Boolean(reservationPreview.error)}
              type="button"
              onClick={() => updateReservation(reservation.id)}
            >
              <Save size={16} />
              {updatingReservationId === reservation.id ? "Güncelleniyor" : "Rezervasyonu Kaydet"}
            </button>
            <a className="admin-secondary-button" href={`tel:${reservation.phone.replace(/\s/g, "")}`}>
              <PhoneCall size={15} />
              Ara
            </a>
            {reservation.email ? (
              <a className="admin-secondary-button" href={`mailto:${reservation.email}`}>
                <Mail size={15} />
                E-posta
              </a>
            ) : null}
            <button className="admin-secondary-button" type="button" onClick={closeReservationEditor}>
              Vazgeç
            </button>
          </div>
        </div>
      );
    }

    if (reservationMode === "new") {
      return (
        <section className="admin-panel-section" data-testid="admin-section-reservations">
          {renderNewReservationForm()}
        </section>
      );
    }

    if (reservationMode === "edit") {
      return (
        <section className="admin-panel-section" data-testid="admin-section-reservations">
          {editingReservation ? renderEditReservationForm(editingReservation) : <div className="admin-empty-state">Rezervasyon bulunamadı.</div>}
        </section>
      );
    }

    return (
      <section className="admin-panel-section" data-testid="admin-section-reservations">
        <div className="admin-section-heading">
          <div>
            <h2>Rezervasyonlar</h2>
            <span>{archivedCount > 0 ? `${archivedCount} arşivlenmiş kayıt var` : "Site ve manuel kayıtlar"}</span>
          </div>
          <div className="admin-inline-actions">
            <button className="admin-primary-button" type="button" onClick={openNewReservationForm}>
              <Plus size={16} />
              Yeni rezervasyon
            </button>
            <button className="admin-secondary-button" type="button" onClick={refreshReservations}>
              <RefreshCw size={16} />
              Yenile
            </button>
          </div>
        </div>
        <div className="admin-toolbar">
          <label className="admin-search-field">
            <Search size={16} />
            <input
              aria-label="Rezervasyonlarda ara"
              placeholder="Misafir, telefon, oda veya tarih ara"
              type="search"
              value={reservationSearch}
              onChange={(event) => setReservationSearch(event.target.value)}
            />
          </label>
          <select
            aria-label="Rezervasyon durumu filtresi"
            className="admin-filter-select"
            value={reservationStatusFilter}
            onChange={(event) => setReservationStatusFilter(event.target.value as "all" | ReservationStatus)}
          >
            <option value="all">Aktif kayıtlar</option>
            {Object.entries(reservationStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="admin-column-control" aria-label="Rezervasyon tablo kolonları">
          {(Object.keys(reservationColumnLabels) as ReservationColumn[]).map((column) => (
            <label key={column}>
              <input
                checked={reservationColumns[column]}
                onChange={() => toggleReservationColumn(column)}
                type="checkbox"
              />
              <span>{reservationColumnLabels[column]}</span>
            </label>
          ))}
        </div>
        {filteredReservations.length === 0 ? (
          <div className="admin-empty-state">Henüz rezervasyon kaydı yok.</div>
        ) : (
          <div className="admin-reservation-table-wrap">
            <table className="admin-reservation-table">
              <thead>
                <tr>
                  {reservationColumns.guest ? <th>Misafir</th> : null}
                  {reservationColumns.room ? <th>Oda</th> : null}
                  {reservationColumns.dates ? <th>Tarih</th> : null}
                  {reservationColumns.guests ? <th>Kişi</th> : null}
                  {reservationColumns.status ? <th>Durum</th> : null}
                  {reservationColumns.payment ? <th>Ödeme</th> : null}
                  {reservationColumns.total ? <th>Tutar</th> : null}
                  {reservationColumns.source ? <th>Kaynak</th> : null}
                  {reservationColumns.actions ? <th>İşlem</th> : null}
                </tr>
              </thead>
              <tbody>
                {filteredReservations.map((reservation) => (
                  <tr key={reservation.id}>
                    {reservationColumns.guest ? (
                      <td>
                        <strong>{reservation.name}</strong>
                        <small>{reservation.phone}</small>
                      </td>
                    ) : null}
                    {reservationColumns.room ? (
                      <td>
                        <strong>{reservation.roomTitle}</strong>
                        <small>{formatBookingCurrency(reservation.pricePerNight, reservation.currency)} / gece</small>
                      </td>
                    ) : null}
                    {reservationColumns.dates ? (
                      <td>
                        <strong>{formatDateLabel(reservation.checkIn)} - {formatDateLabel(reservation.checkOut)}</strong>
                        <small>{reservation.nights} gece</small>
                      </td>
                    ) : null}
                    {reservationColumns.guests ? (
                      <td>
                        <strong>{reservation.adults + reservation.children}</strong>
                        <small>
                          {reservation.adults} yetişkin{reservation.children ? `, ${reservation.children} çocuk` : ""}
                        </small>
                      </td>
                    ) : null}
                    {reservationColumns.status ? (
                      <td>
                        <StatusBadge status={reservation.status} />
                      </td>
                    ) : null}
                    {reservationColumns.payment ? (
                      <td>
                        <PaymentBadge status={reservation.paymentStatus} />
                        {reservation.paymentReference ? <small>{reservation.paymentReference}</small> : null}
                      </td>
                    ) : null}
                    {reservationColumns.total ? (
                      <td>
                        <strong>{formatBookingCurrency(reservation.estimatedTotal, reservation.currency)}</strong>
                        <small>{formatDateTimeLabel(reservation.createdAt)}</small>
                      </td>
                    ) : null}
                    {reservationColumns.source ? (
                      <td>
                        <span className="admin-source-pill">{reservation.source === "admin" ? "Panel" : "Site"}</span>
                      </td>
                    ) : null}
                    {reservationColumns.actions ? (
                      <td>
                        <div className="admin-table-actions">
                          <button className="admin-secondary-button" type="button" onClick={() => openReservationEditor(reservation.id)}>
                            <Pencil size={14} />
                            Düzenle
                          </button>
                          <a className="admin-secondary-button" href={`tel:${reservation.phone.replace(/\s/g, "")}`}>
                            <PhoneCall size={14} />
                            Ara
                          </a>
                          <button
                            className="admin-danger-button"
                            disabled={updatingReservationId === reservation.id}
                            type="button"
                            onClick={() => {
                              if (window.confirm("Bu rezervasyon arşivlensin mi?")) {
                                updateReservationStatus(reservation.id, "archived");
                              }
                            }}
                          >
                            <Trash2 size={14} />
                            Arşiv
                          </button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    );
  }

  function renderPayments() {
    const normalizedSearch = paymentSearch.trim().toLocaleLowerCase("tr-TR");
    const paymentRows = reservations
      .filter((reservation) => reservation.status !== "archived")
      .filter((reservation) => {
        if (paymentStatusFilter !== "all" && reservation.paymentStatus !== paymentStatusFilter) return false;
        if (!normalizedSearch) return true;

        return [
          reservation.name,
          reservation.phone,
          reservation.email,
          reservation.roomTitle,
          reservation.paymentProvider,
          reservation.paymentReference,
          paymentStatusLabels[reservation.paymentStatus]
        ]
          .join(" ")
          .toLocaleLowerCase("tr-TR")
          .includes(normalizedSearch);
      })
      .sort((a, b) => {
        const order: Record<PaymentStatus, number> = {
          processing: 0,
          pending: 1,
          failed: 2,
          paid: 3,
          refunded: 4,
          cancelled: 5,
          not_required: 6
        };

        return order[a.paymentStatus] - order[b.paymentStatus] || b.updatedAt.localeCompare(a.updatedAt);
      });
    const totalPaid = reservations
      .filter((reservation) => reservation.paymentStatus === "paid")
      .reduce((sum, reservation) => sum + (reservation.paymentAmount || reservation.estimatedTotal), 0);
    const pendingCount = reservations.filter((reservation) => ["pending", "processing"].includes(reservation.paymentStatus)).length;
    const failedCount = reservations.filter((reservation) => reservation.paymentStatus === "failed").length;
    const refundableCount = reservations.filter((reservation) => reservation.paymentStatus === "paid").length;

    return (
      <section className="admin-panel-section" data-testid="admin-section-payments">
        <div className="admin-section-heading">
          <div>
            <h2>Ödemeler</h2>
            <span>Sanal POS, manuel ödeme, iade ve başarısız ödeme takibi</span>
          </div>
          <button className="admin-secondary-button" type="button" onClick={refreshReservations}>
            <RefreshCw size={16} />
            Yenile
          </button>
        </div>
        <div className="admin-payment-metrics">
          <div className="admin-payment-metric">
            <span>Tahsil edilen</span>
            <strong>{formatBookingCurrency(totalPaid)}</strong>
          </div>
          <div className="admin-payment-metric">
            <span>Bekleyen ödeme</span>
            <strong>{pendingCount}</strong>
          </div>
          <div className="admin-payment-metric">
            <span>Başarısız ödeme</span>
            <strong>{failedCount}</strong>
          </div>
          <div className="admin-payment-metric">
            <span>İade kontrolü</span>
            <strong>{refundableCount}</strong>
          </div>
        </div>
        <div className="admin-toolbar">
          <label className="admin-search-field">
            <Search size={16} />
            <input
              aria-label="Ödemelerde ara"
              placeholder="Misafir, telefon, referans veya oda ara"
              type="search"
              value={paymentSearch}
              onChange={(event) => setPaymentSearch(event.target.value)}
            />
          </label>
          <select
            aria-label="Ödeme durumu filtresi"
            className="admin-filter-select"
            value={paymentStatusFilter}
            onChange={(event) => setPaymentStatusFilter(event.target.value as "all" | PaymentStatus)}
          >
            <option value="all">Tüm ödeme kayıtları</option>
            {Object.entries(paymentStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        {paymentRows.length ? (
          <div className="admin-payment-board">
            {paymentRows.map((reservation) => {
              const amount = reservation.paymentAmount || reservation.estimatedTotal;
              const isUpdating = updatingPaymentId === reservation.id;

              return (
                <article className="admin-payment-card" key={reservation.id}>
                  <div className="admin-payment-card__top">
                    <div>
                      <strong>{reservation.name}</strong>
                      <span>{reservation.roomTitle} · {formatDateLabel(reservation.checkIn)} - {formatDateLabel(reservation.checkOut)}</span>
                    </div>
                    <div className="admin-payment-card__badges">
                      <PaymentBadge status={reservation.paymentStatus} />
                      <StatusBadge status={reservation.status} />
                    </div>
                  </div>
                  <div className="admin-payment-detail-grid">
                    <div>
                      <span>Tutar</span>
                      <strong>{formatBookingCurrency(amount, reservation.paymentCurrency)}</strong>
                    </div>
                    <div>
                      <span>Sağlayıcı</span>
                      <strong>{reservation.paymentProvider === "manual" ? "Manuel" : reservation.paymentProvider.toUpperCase()}</strong>
                    </div>
                    <div>
                      <span>Referans</span>
                      <strong>{reservation.paymentReference || "-"}</strong>
                    </div>
                    <div>
                      <span>Güncelleme</span>
                      <strong>{formatDateTimeLabel(reservation.paymentUpdatedAt || reservation.updatedAt)}</strong>
                    </div>
                  </div>
                  {reservation.paymentFailureReason ? (
                    <p className="admin-payment-warning">{reservation.paymentFailureReason}</p>
                  ) : null}
                  <TextField
                    label="Ödeme notu"
                    value={paymentNotes[reservation.id] ?? ""}
                    onChange={(value) => setPaymentNotes((current) => ({ ...current, [reservation.id]: value }))}
                  />
                  <div className="admin-inline-actions">
                    <button
                      className="admin-primary-button"
                      disabled={isUpdating}
                      type="button"
                      onClick={() => updatePaymentStatus(reservation.id, "mark_paid")}
                    >
                      Ödendi işaretle
                    </button>
                    <button
                      className="admin-secondary-button"
                      disabled={isUpdating}
                      type="button"
                      onClick={() => updatePaymentStatus(reservation.id, "mark_failed")}
                    >
                      Başarısız
                    </button>
                    <button
                      className="admin-secondary-button"
                      disabled={isUpdating}
                      type="button"
                      onClick={() => updatePaymentStatus(reservation.id, "mark_cancelled")}
                    >
                      İptal
                    </button>
                    <button
                      className="admin-secondary-button"
                      disabled={isUpdating}
                      type="button"
                      onClick={() => updatePaymentStatus(reservation.id, "mark_refunded")}
                    >
                      İade
                    </button>
                    <button
                      className="admin-danger-button"
                      disabled={isUpdating}
                      type="button"
                      onClick={() => updatePaymentStatus(reservation.id, "clear_payment")}
                    >
                      Sıfırla
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="admin-empty-state">Bu filtreyle ödeme kaydı bulunamadı.</div>
        )}
      </section>
    );
  }

  function renderGuests() {
    const normalizedSearch = guestSearch.trim().toLocaleLowerCase("tr-TR");
    const filteredGuests = guestProfiles.filter((guest) => {
      if (!normalizedSearch) return true;
      return [guest.name, guest.phone, guest.email, guest.roomTitles.join(" ")]
        .join(" ")
        .toLocaleLowerCase("tr-TR")
        .includes(normalizedSearch);
    });

    return (
      <section className="admin-panel-section" data-testid="admin-section-guests">
        <div className="admin-section-heading">
          <div>
            <h2>Misafirler</h2>
            <span>Rezervasyonlardan oluşturulan misafir profilleri</span>
          </div>
          <button className="admin-secondary-button" type="button" onClick={() => setActiveTab("reservations")}>
            <Plus size={16} />
            Rezervasyon ekle
          </button>
        </div>
        <div className="admin-toolbar">
          <label className="admin-search-field">
            <Search size={16} />
            <input
              aria-label="Misafirlerde ara"
              placeholder="Ad, telefon, e-posta veya oda ara"
              type="search"
              value={guestSearch}
              onChange={(event) => setGuestSearch(event.target.value)}
            />
          </label>
        </div>
        {filteredGuests.length ? (
          <div className="admin-data-table">
            <div className="admin-data-table__head admin-data-table__row--guests">
              <span>Misafir</span>
              <span>İletişim</span>
              <span>Rezervasyon</span>
              <span>Profil</span>
              <span>Aksiyon</span>
            </div>
            {filteredGuests.map((guest) => (
              <div className="admin-data-table__row admin-data-table__row--guests" key={guest.key}>
                <span>
                  <strong>{guest.name}</strong>
                  <small>{guest.roomTitles.slice(0, 2).join(", ")}</small>
                </span>
                <span>
                  <strong>{guest.phone}</strong>
                  <small>{guest.email || "E-posta yok"}</small>
                </span>
                <span>
                  <strong>{guest.reservationCount} kayıt</strong>
                  <small>{formatBookingCurrency(guest.totalSpend)} toplam</small>
                </span>
                <span>
                  <span className={`admin-status-badge admin-status-badge--${guest.isComplete ? "success" : "warning"}`}>
                    {guest.isComplete ? "Tamamlandı" : "Eksik"}
                  </span>
                </span>
                <span className="admin-table-actions">
                  <a className="admin-secondary-button" href={`tel:${guest.phone.replace(/\s/g, "")}`}>
                    <PhoneCall size={15} />
                    Ara
                  </a>
                  <button
                    className="admin-secondary-button"
                    type="button"
                    onClick={() => {
                      setReservationSearch(guest.name);
                      setReservationStatusFilter("all");
                      setActiveTab("reservations");
                    }}
                  >
                    Kayıtlar
                  </button>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="admin-empty-state">Bu aramayla misafir bulunamadı.</div>
        )}
      </section>
    );
  }

  function renderInbox() {
    return (
      <section className="admin-panel-section" data-testid="admin-section-inbox">
        <div className="admin-section-heading">
          <div>
            <h2>Gelen Kutusu</h2>
            <span>Siteden gelen yeni ve görüşülen talepler</span>
          </div>
          <button className="admin-secondary-button" type="button" onClick={refreshReservations}>
            <RefreshCw size={16} />
            Yenile
          </button>
        </div>
        {inboxReservations.length ? (
          <div className="admin-inbox-list">
            {inboxReservations.map((reservation) => (
              <article className="admin-inbox-item" key={reservation.id}>
                <div className="admin-inbox-item__main">
                  <div>
                    <strong>{reservation.name}</strong>
                    <span>{reservation.roomTitle} · {formatDateLabel(reservation.checkIn)} - {formatDateLabel(reservation.checkOut)}</span>
                  </div>
                  <StatusBadge status={reservation.status} />
                </div>
                <p>{reservation.note || "Misafir not bırakmadı."}</p>
                <div className="admin-inbox-item__meta">
                  <span>{reservation.nights} gece</span>
                  <span>{reservation.adults + reservation.children} misafir</span>
                  <span>{formatBookingCurrency(reservation.estimatedTotal, reservation.currency)}</span>
                  <span>{paymentStatusLabels[reservation.paymentStatus]}</span>
                  <span>{formatDateTimeLabel(reservation.createdAt)}</span>
                </div>
                <div className="admin-inline-actions">
                  <a className="admin-secondary-button" href={`tel:${reservation.phone.replace(/\s/g, "")}`}>
                    <PhoneCall size={15} />
                    Ara
                  </a>
                  {reservation.email ? (
                    <a className="admin-secondary-button" href={`mailto:${reservation.email}`}>
                      <Mail size={15} />
                      E-posta
                    </a>
                  ) : null}
                  <button
                    className="admin-secondary-button"
                    disabled={updatingReservationId === reservation.id}
                    type="button"
                    onClick={() => updateReservationStatus(reservation.id, "contacted")}
                  >
                    Görüşüldü
                  </button>
                  <button
                    className="admin-primary-button"
                    disabled={updatingReservationId === reservation.id}
                    type="button"
                    onClick={() => updateReservationStatus(reservation.id, "confirmed")}
                  >
                    Onayla
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="admin-empty-state">Yanıt bekleyen web talebi yok.</div>
        )}
      </section>
    );
  }

  function renderHistory() {
    const activity = reservations
      .slice()
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 24);

    return (
      <div className="admin-section-stack">
        <section className="admin-panel-section" data-testid="admin-section-history">
          <div className="admin-section-heading">
            <div>
              <h2>Hareketler</h2>
              <span>Rezervasyon hareketleri ve içerik tarihçesi</span>
            </div>
          </div>
          {activity.length ? (
            <div className="admin-activity-list admin-activity-list--timeline">
              {activity.map((reservation) => (
                <div className="admin-activity-item" key={reservation.id}>
                  <strong>{reservationStatusLabels[reservation.status]} · {reservation.name}</strong>
                  <span>
                    {reservation.roomTitle} · {formatDateLabel(reservation.checkIn)} - {formatDateLabel(reservation.checkOut)} ·{" "}
                    {formatDateTimeLabel(reservation.updatedAt)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="admin-empty-state">Henüz rezervasyon hareketi yok.</div>
          )}
        </section>
        <section className="admin-panel-section" data-testid="admin-section-history-content">
          <div className="admin-section-heading">
            <div>
              <h2>Site tarihçesi</h2>
              <span>Tarihçe sayfasında görünen içerik</span>
            </div>
          </div>
          <div className="admin-form-grid">
            <TextField
              label="Tarihçe başlığı"
              value={content.pages.history.title}
              onChange={(value) => updateHistoryPageField("title", value)}
            />
            <TextArea
              label="Tarihçe metni"
              value={content.pages.history.body}
              onChange={(value) => updateHistoryPageField("body", value)}
            />
            <ImagePicker
              images={images}
              label="Tarihçe görseli"
              onUpload={uploadAndSelectImage}
              testId="image-picker-history"
              value={content.pages.history.image}
              onChange={(value) => updateHistoryPageField("image", value)}
            />
          </div>
          <EditableStringList
            addLabel="Satır ekle"
            items={content.pages.history.timeline}
            label="Tarihçe satırları"
            onAdd={() =>
              setContent((current) => ({
                ...current,
                pages: {
                  ...current.pages,
                  history: {
                    ...current.pages.history,
                    timeline: [...current.pages.history.timeline, "Yeni tarihçe satırı"]
                  }
                }
              }))
            }
            onChange={updateHistoryTimeline}
            onRemove={(index) =>
              setContent((current) => ({
                ...current,
                pages: {
                  ...current.pages,
                  history: {
                    ...current.pages.history,
                    timeline: current.pages.history.timeline.filter((_, currentIndex) => currentIndex !== index)
                  }
                }
              }))
            }
          />
        </section>
      </div>
    );
  }

  function renderRooms() {
    const normalizedSearch = roomSearch.trim().toLocaleLowerCase("tr-TR");
    const visibleRooms = content.rooms
      .map((room, index) => ({ index, room }))
      .filter(({ room }) => {
        if (!normalizedSearch) return true;
        return [room.title, room.slug, room.price, room.capacity, room.bed]
          .join(" ")
          .toLocaleLowerCase("tr-TR")
          .includes(normalizedSearch);
      });

    return (
      <div className="admin-rooms-layout">
        <aside className="admin-room-list">
          <div className="admin-list-heading">
            <div>
              <strong>Oda tipleri</strong>
              <span>{content.rooms.length} oda tipi yönetiliyor</span>
            </div>
            <button className="admin-icon-button" title="Oda ekle" type="button" onClick={addRoom}>
              <Plus size={17} />
            </button>
          </div>
          <label className="admin-search-field admin-search-field--compact">
            <Search size={15} />
            <input
              aria-label="Odalarda ara"
              placeholder="Oda ara"
              type="search"
              value={roomSearch}
              onChange={(event) => setRoomSearch(event.target.value)}
            />
          </label>
          {visibleRooms.map(({ room, index }) => (
            <button
              className={`admin-room-tab${selectedRoom?.slug === room.slug ? " is-active" : ""}`}
              key={`${room.slug}-${index}`}
              onClick={() => setSelectedRoomIndex(index)}
              type="button"
            >
              <span>{room.title}</span>
              <small>{room.price} · {room.count} oda · {room.capacity}</small>
            </button>
          ))}
          {visibleRooms.length === 0 ? <div className="admin-empty-state">Bu aramayla oda bulunamadı.</div> : null}
        </aside>
        {selectedRoom ? (
          <section className="admin-panel-section" data-testid="admin-section-room-editor">
            <div className="admin-section-heading">
              <h2>{selectedRoom.title}</h2>
              <span>{selectedRoom.slug}</span>
            </div>
            <div className="admin-inline-actions">
              <button
                className="admin-secondary-button"
                type="button"
                onClick={() => setContent((current) => ({ ...current, rooms: moveItem(current.rooms, selectedRoomIndex, -1) }))}
              >
                <ArrowUp size={16} />
                Yukarı
              </button>
              <button
                className="admin-secondary-button"
                type="button"
                onClick={() => setContent((current) => ({ ...current, rooms: moveItem(current.rooms, selectedRoomIndex, 1) }))}
              >
                <ArrowDown size={16} />
                Aşağı
              </button>
            <button
              className="admin-danger-button"
              data-testid="selected-room-delete"
              type="button"
              onClick={() => removeRoom(selectedRoomIndex)}
            >
              <Trash2 size={16} />
              Sil
            </button>
            </div>
            <div className="admin-form-grid">
              <TextField
                label="Oda adı"
                value={selectedRoom.title}
                onChange={(value) => updateRoomField(selectedRoomIndex, "title", value)}
                onBlur={(value) => updateRoomField(selectedRoomIndex, "slug", slugify(value) || selectedRoom.slug)}
              />
              <TextField
                label="Slug"
                value={selectedRoom.slug}
                onChange={(value) => updateRoomField(selectedRoomIndex, "slug", slugify(value))}
              />
              <SelectField
                label="Ton"
                value={selectedRoom.tone}
                onChange={(value) => updateRoomField(selectedRoomIndex, "tone", value as Room["tone"])}
                options={[
                  ["room", "Standart"],
                  ["suite", "Suit"],
                  ["family", "Aile"]
                ]}
              />
              <NumberField
                label="Oda sayısı"
                value={selectedRoom.count}
                onChange={(value) => updateRoomField(selectedRoomIndex, "count", value)}
              />
              <TextField
                label="Fiyat"
                value={selectedRoom.price}
                onChange={(value) => updateRoomField(selectedRoomIndex, "price", value)}
              />
              <TextField
                label="Metrekare"
                value={selectedRoom.size}
                onChange={(value) => updateRoomField(selectedRoomIndex, "size", value)}
              />
              <TextField
                label="Kapasite"
                value={selectedRoom.capacity}
                onChange={(value) => updateRoomField(selectedRoomIndex, "capacity", value)}
              />
              <TextField
                label="Yatak"
                value={selectedRoom.bed}
                onChange={(value) => updateRoomField(selectedRoomIndex, "bed", value)}
              />
              <TextArea
                label="Kısa açıklama"
                value={selectedRoom.description}
                onChange={(value) => updateRoomField(selectedRoomIndex, "description", value)}
              />
              <TextArea
                label="Detay açıklaması"
                value={selectedRoom.longDescription}
                onChange={(value) => updateRoomField(selectedRoomIndex, "longDescription", value)}
              />
              <ImagePicker
                images={images}
                label="Kapak görseli"
                onUpload={uploadAndSelectImage}
                testId="image-picker-room-cover"
                value={selectedRoom.image}
                onChange={(value) => updateRoomField(selectedRoomIndex, "image", value)}
              />
            </div>
            <EditableStringList
              addLabel="İmkan ekle"
              items={selectedRoom.amenities}
              label="Oda imkanları"
              onAdd={() => updateRoom(selectedRoomIndex, { ...selectedRoom, amenities: [...selectedRoom.amenities, "Yeni imkan"] })}
              onChange={(index, value) => updateRoomAmenity(selectedRoomIndex, index, value)}
              onRemove={(index) =>
                updateRoom(selectedRoomIndex, {
                  ...selectedRoom,
                  amenities: selectedRoom.amenities.filter((_, currentIndex) => currentIndex !== index)
                })
              }
            />
            <div className="admin-array-block">
              <div className="admin-list-heading">
                <strong>Oda galerisi</strong>
                <button
                  className="admin-secondary-button"
                  type="button"
                  onClick={() => updateRoom(selectedRoomIndex, { ...selectedRoom, gallery: [...selectedRoom.gallery, selectedRoom.image] })}
                >
                  <Plus size={16} />
                  Görsel ekle
                </button>
              </div>
              {selectedRoom.gallery.map((image, index) => (
                <div className="admin-media-row" key={`${image}-${index}`}>
                  <ImagePicker
                    images={images}
                    label={`Galeri ${index + 1}`}
                    onUpload={uploadAndSelectImage}
                    testId={`image-picker-room-gallery-${index}`}
                    value={image}
                    onChange={(value) => updateRoomGallery(selectedRoomIndex, index, value)}
                  />
                  <button
                    className="admin-icon-button"
                    data-testid={`room-gallery-remove-${index}`}
                    title="Sil"
                    type="button"
                    onClick={() => removeRoomGalleryImage(selectedRoomIndex, index)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    );
  }

  function renderGallery() {
    return (
      <section className="admin-panel-section" data-testid="admin-section-gallery">
        <div className="admin-section-heading">
          <h2>Galeri</h2>
          <button
            className="admin-secondary-button"
            type="button"
            onClick={() =>
              setContent((current) => ({
                ...current,
                galleryItems: [
                  ...current.galleryItems,
                  { title: "Yeni görsel", tone: "detail", image: images[0]?.src ?? "/hotel-images/hero-facade-night.webp" }
                ]
              }))
            }
          >
            <Plus size={16} />
            Görsel ekle
          </button>
        </div>
        <div className="admin-gallery-editor">
          {content.galleryItems.map((item, index) => (
            <article className="admin-gallery-item" key={`${item.image}-${index}`}>
              <ImagePreview src={item.image} alt={item.title} />
              <div className="admin-gallery-item__fields">
                <TextField
                  label="Başlık"
                  value={item.title}
                  onChange={(value) => updateGalleryItem(index, { ...item, title: value })}
                />
                <TextField
                  label="Ton"
                  value={item.tone}
                  onChange={(value) => updateGalleryItem(index, { ...item, tone: value })}
                />
                <ImagePicker
                  images={images}
                  label="Görsel"
                  onUpload={uploadAndSelectImage}
                  showPreview={false}
                  testId={`image-picker-gallery-${index}`}
                  value={item.image}
                  onChange={(value) => updateGalleryItem(index, { ...item, image: value })}
                />
              </div>
              <div className="admin-row-actions">
                <button
                  className="admin-icon-button"
                  title="Yukarı taşı"
                  type="button"
                  onClick={() => setContent((current) => ({ ...current, galleryItems: moveItem(current.galleryItems, index, -1) }))}
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  className="admin-icon-button"
                  title="Aşağı taşı"
                  type="button"
                  onClick={() => setContent((current) => ({ ...current, galleryItems: moveItem(current.galleryItems, index, 1) }))}
                >
                  <ArrowDown size={16} />
                </button>
                <button
                  className="admin-icon-button admin-icon-button--danger"
                  data-testid={`gallery-item-remove-${index}`}
                  title="Sil"
                  type="button"
                  onClick={() => removeGalleryItem(index)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    );
  }

  function renderServices() {
    return (
      <div className="admin-section-stack">
        <EditableStringList
          addLabel="Hizmet ekle"
          items={content.services}
          label="Hizmetler"
          onAdd={() => setContent((current) => ({ ...current, services: [...current.services, "Yeni hizmet"] }))}
          onChange={(index, value) =>
            setContent((current) => ({
              ...current,
              services: replaceItem(current.services, index, value)
            }))
          }
          onRemove={(index) =>
            setContent((current) => ({
              ...current,
              services: current.services.filter((_, currentIndex) => currentIndex !== index)
            }))
          }
        />
        <section className="admin-panel-section" data-testid="admin-section-features">
          <div className="admin-section-heading">
            <h2>Oda öne çıkanları</h2>
            <button
              className="admin-secondary-button"
              type="button"
              onClick={() =>
                setContent((current) => ({
                  ...current,
                  roomFeatures: [
                    ...current.roomFeatures,
                    { icon: "wifi", title: "Yeni özellik", description: "Kısa açıklama." }
                  ]
                }))
              }
            >
              <Plus size={16} />
              Özellik ekle
            </button>
          </div>
          <div className="admin-feature-list">
            {content.roomFeatures.map((feature, index) => (
              <article className="admin-feature-editor" key={`${feature.title}-${index}`}>
                <SelectField
                  label="İkon"
                  value={feature.icon}
                  onChange={(value) => updateFeature(index, { ...feature, icon: value as RoomFeature["icon"] })}
                  options={[
                    ["smart-entry", "Akıllı giriş"],
                    ["safe", "Kasa"],
                    ["wifi", "Wi-Fi"]
                  ]}
                />
                <TextField
                  label="Başlık"
                  value={feature.title}
                  onChange={(value) => updateFeature(index, { ...feature, title: value })}
                />
                <TextArea
                  label="Açıklama"
                  value={feature.description}
                  onChange={(value) => updateFeature(index, { ...feature, description: value })}
                />
                <button
                  className="admin-icon-button admin-icon-button--danger"
                  title="Sil"
                  type="button"
                  onClick={() =>
                    setContent((current) => ({
                      ...current,
                      roomFeatures: current.roomFeatures.filter((_, currentIndex) => currentIndex !== index)
                    }))
                  }
                >
                  <Trash2 size={16} />
                </button>
              </article>
            ))}
          </div>
        </section>
      </div>
    );
  }

  function renderSettings() {
    return (
      <div className="admin-section-stack">
        <section className="admin-panel-section" data-testid="admin-section-security">
          <div className="admin-section-heading">
            <div>
              <h2>Güvenlik</h2>
              <span>Yönetim paneli şifresi</span>
            </div>
            <KeyRound size={22} />
          </div>
          <div className="admin-form-grid">
            <PasswordField
              autoComplete="current-password"
              label="Mevcut şifre"
              value={passwordForm.currentPassword}
              onChange={(value) => updatePasswordField("currentPassword", value)}
            />
            <PasswordField
              autoComplete="new-password"
              label="Yeni şifre"
              value={passwordForm.newPassword}
              onChange={(value) => updatePasswordField("newPassword", value)}
            />
            <PasswordField
              autoComplete="new-password"
              label="Yeni şifre tekrar"
              value={passwordForm.confirmPassword}
              onChange={(value) => updatePasswordField("confirmPassword", value)}
            />
          </div>
          <p className="admin-auth-note">En az 10 karakter, küçük harf, rakam ve sembol kullan. Şifre değişince eski oturum anahtarı geçersiz olur.</p>
          <button
            className="admin-primary-button"
            data-testid="admin-change-password"
            disabled={isChangingPassword}
            type="button"
            onClick={changePassword}
          >
            <KeyRound size={16} />
            {isChangingPassword ? "Değiştiriliyor" : "Şifreyi Değiştir"}
          </button>
        </section>
        <section className="admin-panel-section" data-testid="admin-section-contact">
          <div className="admin-section-heading">
            <h2>İletişim</h2>
            <span>Telefon, e-posta, konum</span>
          </div>
          <div className="admin-form-grid">
            <TextField label="Telefon" value={content.site.phone} onChange={(value) => updateSiteField("phone", value)} />
            <TextField
              label="Telefon linki"
              value={content.site.phoneHref}
              onChange={(value) => updateSiteField("phoneHref", value)}
            />
            <TextField label="WhatsApp" value={content.site.whatsapp} onChange={(value) => updateSiteField("whatsapp", value)} />
            <TextField
              label="WhatsApp linki"
              value={content.site.whatsappHref}
              onChange={(value) => updateSiteField("whatsappHref", value)}
            />
            <TextField label="E-posta" value={content.site.email} onChange={(value) => updateSiteField("email", value)} />
            <TextField
              label="E-posta linki"
              value={content.site.emailHref}
              onChange={(value) => updateSiteField("emailHref", value)}
            />
            <TextArea label="Adres" value={content.site.address} onChange={(value) => updateSiteField("address", value)} />
            <TextArea label="Harita linki" value={content.site.mapHref} onChange={(value) => updateSiteField("mapHref", value)} />
            <TextArea
              label="Harita embed"
              value={content.site.mapEmbed}
              onChange={(value) => updateSiteField("mapEmbed", value)}
            />
          </div>
        </section>
        <section className="admin-panel-section" data-testid="admin-section-pages">
          <div className="admin-section-heading">
            <h2>Sayfa girişleri</h2>
            <span>Başlık ve metinler</span>
          </div>
          <div className="admin-form-grid">
            <TextField
              label="Odalar başlığı"
              value={content.pages.rooms.title}
              onChange={(value) => updateSimplePageField("rooms", "title", value)}
            />
            <TextArea
              label="Odalar metni"
              value={content.pages.rooms.body}
              onChange={(value) => updateSimplePageField("rooms", "body", value)}
            />
            <TextField
              label="Galeri başlığı"
              value={content.pages.gallery.title}
              onChange={(value) => updateSimplePageField("gallery", "title", value)}
            />
            <TextArea
              label="Galeri metni"
              value={content.pages.gallery.body}
              onChange={(value) => updateSimplePageField("gallery", "body", value)}
            />
            <TextField
              label="İletişim başlığı"
              value={content.pages.contact.title}
              onChange={(value) => updateContactPageField("title", value)}
            />
            <TextArea
              label="İletişim metni"
              value={content.pages.contact.body}
              onChange={(value) => updateContactPageField("body", value)}
            />
            <TextField
              label="İletişim paneli"
              value={content.pages.contact.contactTitle}
              onChange={(value) => updateContactPageField("contactTitle", value)}
            />
            <TextField
              label="Konum paneli"
              value={content.pages.contact.locationTitle}
              onChange={(value) => updateContactPageField("locationTitle", value)}
            />
            <TextField
              label="Tarihçe başlığı"
              value={content.pages.history.title}
              onChange={(value) => updateHistoryPageField("title", value)}
            />
            <TextArea
              label="Tarihçe metni"
              value={content.pages.history.body}
              onChange={(value) => updateHistoryPageField("body", value)}
            />
            <ImagePicker
              images={images}
              label="Tarihçe görseli"
              onUpload={uploadAndSelectImage}
              testId="image-picker-history"
              value={content.pages.history.image}
              onChange={(value) => updateHistoryPageField("image", value)}
            />
          </div>
          <EditableStringList
            addLabel="Satır ekle"
            items={content.pages.history.timeline}
            label="Tarihçe satırları"
            onAdd={() =>
              setContent((current) => ({
                ...current,
                pages: {
                  ...current.pages,
                  history: {
                    ...current.pages.history,
                    timeline: [...current.pages.history.timeline, "Yeni tarihçe satırı"]
                  }
                }
              }))
            }
            onChange={updateHistoryTimeline}
            onRemove={(index) =>
              setContent((current) => ({
                ...current,
                pages: {
                  ...current.pages,
                  history: {
                    ...current.pages.history,
                    timeline: current.pages.history.timeline.filter((_, currentIndex) => currentIndex !== index)
                  }
                }
              }))
            }
          />
        </section>
      </div>
    );
  }

  function renderImages() {
    async function copyImagePath(src: string) {
      try {
        await navigator.clipboard.writeText(src);
        flash("success", `${src} kopyalandı.`);
      } catch {
        flash("error", "Görsel yolu kopyalanamadı. Tarayıcı izinlerini kontrol edin.");
      }
    }

    return (
      <section className="admin-panel-section" data-testid="admin-section-images">
        <div className="admin-section-heading">
          <h2>Görsel kütüphanesi</h2>
          <label className="admin-upload-button">
            <Upload size={16} />
            {isUploading ? "Yükleniyor" : "Görsel yükle"}
            <input
              accept="image/jpeg,image/png,image/webp,image/avif"
              data-testid="image-library-upload"
              disabled={isUploading}
              onChange={uploadImage}
              type="file"
            />
          </label>
        </div>
        <div className="admin-image-grid">
          {images.map((image) => {
            const usageCount = getImageUsageCount(image.src);
            const usageText = usageCount > 0 ? `${usageCount} yerde kullanılıyor` : "Kullanılmıyor";

            return (
              <article className="admin-image-tile" key={image.src}>
                <ImagePreview alt={image.name} src={image.src} />
                <div className="admin-image-tile__meta">
                  <strong>{image.name}</strong>
                  <small>{formatFileSize(image.size)} · {usageText}</small>
                </div>
                <div className="admin-image-tile__actions">
                  <button
                    className="admin-secondary-button"
                    type="button"
                    onClick={() => copyImagePath(image.src)}
                  >
                    <Copy size={15} />
                    Yolu kopyala
                  </button>
                  <button
                    className="admin-danger-button"
                    disabled={deletingImageSrc === image.src}
                    title={isUploadedImagePath(image.src) ? "Görseli kalıcı sil" : "Proje görseli kalıcı silinmez"}
                    type="button"
                    onClick={() => deleteImage(image)}
                  >
                    <Trash2 size={15} />
                    {deletingImageSrc === image.src ? "Siliniyor" : "Sil"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <div className="admin-dashboard" data-testid="admin-dashboard">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span>ŞE</span>
          <div>
            <strong>Şükrü Efendi</strong>
            <small>Yönetim Paneli</small>
          </div>
        </div>
        <p className="admin-nav-label">Menü</p>
        <nav className="admin-nav" aria-label="Yönetim menüsü">
          {tabs.map((tab) => (
            <button
              className={activeTab === tab.id ? "is-active" : ""}
              data-testid={`admin-tab-${tab.id}`}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              type="button"
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </aside>
      <section className="admin-workspace">
        <header className="admin-topbar">
          <div>
            <p className="admin-kicker">Yönetim Paneli</p>
            <h1>{tabs.find((tab) => tab.id === activeTab)?.label}</h1>
          </div>
          <div className="admin-topbar-actions">
            <button
              className="admin-primary-button"
              data-testid="admin-save"
              disabled={isSaving}
              type="button"
              onClick={saveContent}
            >
              <Save size={18} />
              {isSaving ? "Kaydediliyor" : "Kaydet"}
            </button>
            <button className="admin-secondary-button" data-testid="admin-logout" type="button" onClick={logout}>
              <LogOut size={17} />
              Çıkış
            </button>
          </div>
        </header>
        <div className="admin-stat-grid">
          {stats.map((stat) => (
            <div className="admin-stat" key={stat.label}>
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
            </div>
          ))}
        </div>
        {message ? <p className={`admin-alert admin-alert--${messageType}`}>{message}</p> : null}
        {activeTab === "dashboard" ? renderDashboard() : null}
        {activeTab === "rooms" ? renderRooms() : null}
        {activeTab === "reservations" ? renderReservations() : null}
        {activeTab === "payments" ? renderPayments() : null}
        {activeTab === "guests" ? renderGuests() : null}
        {activeTab === "inbox" ? renderInbox() : null}
        {activeTab === "history" ? renderHistory() : null}
        {activeTab === "content" ? renderContent() : null}
        {activeTab === "gallery" ? renderGallery() : null}
        {activeTab === "services" ? renderServices() : null}
        {activeTab === "images" ? renderImages() : null}
        {activeTab === "settings" ? renderSettings() : null}
      </section>
    </div>
  );
}

type ReservationPreview = ReturnType<typeof getReservationPreview>;

function StatusBadge({ status }: { status: ReservationStatus }) {
  return (
    <span className={`admin-status-badge admin-status-badge--${getStatusTone(status)}`}>
      {reservationStatusLabels[status]}
    </span>
  );
}

function PaymentBadge({ status }: { status: PaymentStatus }) {
  return (
    <span className={`admin-status-badge admin-status-badge--${getPaymentTone(status)}`}>
      {paymentStatusLabels[status]}
    </span>
  );
}

function ReservationAvailabilityPreview({ compact = false, preview }: { compact?: boolean; preview: ReservationPreview }) {
  const availability = preview.availability;

  if (!availability) {
    return <div className="admin-reservation-preview admin-reservation-preview--warning">Oda bilgisi bulunamadı.</div>;
  }

  const className = [
    "admin-reservation-preview",
    compact ? "admin-reservation-preview--compact" : "",
    preview.error || !availability.isAvailable ? "admin-reservation-preview--warning" : ""
  ]
    .filter(Boolean)
    .join(" ");
  const availabilityLabel = availability.isAvailable
    ? `${availability.availableRooms}/${availability.totalRooms} oda müsait`
    : "Onaylanırsa çakışır";

  return (
    <div className={className}>
      <div>
        <strong>{preview.error || availabilityLabel}</strong>
        <span>{preview.pricing.nights} gece · {formatBookingCurrency(preview.pricing.estimatedTotal, availability.currency)}</span>
      </div>
      <div>
        <strong>
          {preview.guestCount}/{preview.capacityLimit} misafir
        </strong>
        <span>{preview.pricing.pricePerNight > 0 ? `${formatBookingCurrency(preview.pricing.pricePerNight, availability.currency)} / gece` : "Fiyat girilmemiş"}</span>
      </div>
    </div>
  );
}

function TextField({
  disabled = false,
  label,
  onBlur,
  onChange,
  type = "text",
  value
}: {
  disabled?: boolean;
  label: string;
  onBlur?: (value: string) => void;
  onChange: (value: string) => void;
  type?: "email" | "tel" | "text" | "url";
  value: string;
}) {
  return (
    <label className="admin-field">
      <span>{label}</span>
      <input
        disabled={disabled}
        onBlur={(event) => onBlur?.(event.target.value)}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        value={value}
      />
    </label>
  );
}

function PasswordField({
  autoComplete,
  label,
  onChange,
  value
}: {
  autoComplete: "current-password" | "new-password";
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="admin-field">
      <span>{label}</span>
      <input
        autoComplete={autoComplete}
        minLength={10}
        onChange={(event) => onChange(event.target.value)}
        type="password"
        value={value}
      />
    </label>
  );
}

function DateField({
  disabled = false,
  label,
  min,
  onChange,
  value
}: {
  disabled?: boolean;
  label: string;
  min?: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="admin-field">
      <span>{label}</span>
      <input disabled={disabled} min={min} onChange={(event) => onChange(event.target.value)} type="date" value={value} />
    </label>
  );
}

function NumberField({
  disabled = false,
  label,
  max,
  min = 0,
  onChange,
  value
}: {
  disabled?: boolean;
  label: string;
  max?: number;
  min?: number;
  onChange: (value: number) => void;
  value: number;
}) {
  return (
    <label className="admin-field">
      <span>{label}</span>
      <input disabled={disabled} max={max} min={min} onChange={(event) => onChange(Number(event.target.value))} type="number" value={value} />
    </label>
  );
}

function TextArea({
  disabled = false,
  label,
  onChange,
  value
}: {
  disabled?: boolean;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="admin-field admin-field--wide">
      <span>{label}</span>
      <textarea disabled={disabled} onChange={(event) => onChange(event.target.value)} rows={4} value={value} />
    </label>
  );
}

function SelectField({
  disabled = false,
  label,
  onChange,
  options,
  value
}: {
  disabled?: boolean;
  label: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
  value: string;
}) {
  return (
    <label className="admin-field">
      <span>{label}</span>
      <select disabled={disabled} onChange={(event) => onChange(event.target.value)} value={value}>
        {options.map(([optionValue, labelText]) => (
          <option key={optionValue} value={optionValue}>
            {labelText}
          </option>
        ))}
      </select>
    </label>
  );
}

function ImagePicker({
  images,
  label,
  onChange,
  onUpload,
  showPreview = true,
  testId,
  value
}: {
  images: AdminImage[];
  label: string;
  onChange: (value: string) => void;
  onUpload: (file: File) => Promise<string>;
  showPreview?: boolean;
  testId: string;
  value: string;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const valueExists = images.some((image) => image.src === value);

  async function uploadSelectedImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    setIsUploading(true);

    try {
      const src = await onUpload(file);
      onChange(src);
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  }

  return (
    <div className="admin-field admin-field--wide" data-testid={testId}>
      <span>{label}</span>
      <div className={`admin-image-picker${showPreview ? "" : " admin-image-picker--no-preview"}`}>
        {showPreview ? <ImagePreview alt={label} src={value} /> : null}
        <div className="admin-image-picker__controls">
          <label className="admin-upload-button admin-upload-button--inline">
            <Upload size={16} />
            {isUploading ? "Yükleniyor" : value ? "Görseli değiştir" : "Görsel yükle"}
            <input
              accept="image/jpeg,image/png,image/webp,image/avif"
              data-testid={`${testId}-upload`}
              disabled={isUploading}
              onChange={uploadSelectedImage}
              type="file"
            />
          </label>
          <select
            aria-label={`${label} için kütüphaneden seç`}
            data-testid={`${testId}-select`}
            onChange={(event) => onChange(event.target.value)}
            value={valueExists ? value : ""}
          >
            {!valueExists ? <option value="">{value || "Kütüphaneden seç"}</option> : null}
            {images.map((image) => (
              <option key={image.src} value={image.src}>
                {image.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

function ImagePreview({ alt, src }: { alt: string; src: string }) {
  return (
    <div className="admin-image-preview">
      {src ? <Image alt={alt} fill sizes="96px" src={src} /> : <span />}
    </div>
  );
}

function EditableStringList({
  addLabel,
  items,
  label,
  onAdd,
  onChange,
  onRemove
}: {
  addLabel: string;
  items: string[];
  label: string;
  onAdd: () => void;
  onChange: (index: number, value: string) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <section className="admin-panel-section">
      <div className="admin-section-heading">
        <h2>{label}</h2>
        <button className="admin-secondary-button" type="button" onClick={onAdd}>
          <Plus size={16} />
          {addLabel}
        </button>
      </div>
      <div className="admin-string-list">
        {items.map((item, index) => (
          <div className="admin-string-row" key={`${item}-${index}`}>
            <input onChange={(event) => onChange(index, event.target.value)} type="text" value={item} />
            <button className="admin-icon-button admin-icon-button--danger" title="Sil" type="button" onClick={() => onRemove(index)}>
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
