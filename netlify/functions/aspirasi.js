const MAX_FILES = 3;
const MAX_FILE_SIZE = 4 * 1024 * 1024;
const MAX_TOTAL_SIZE = 5 * 1024 * 1024;

const ALLOWED_TYPES = {
    "image/jpeg": "photo",
    "image/png": "photo",
    "image/webp": "photo",
    "video/mp4": "video",
    "video/quicktime": "video",
    "video/webm": "video"
};

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            "Content-Type": "application/json; charset=utf-8"
        }
    });
}

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

export default async (request) => {
    if (request.method !== "POST") {
        return jsonResponse({
            success: false,
            message: "Method tidak diizinkan."
        }, 405);
    }

    try {
        const contentType = request.headers.get("content-type") || "";

        if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
            return jsonResponse({
                success: false,
                message: "Format permintaan harus multipart/form-data."
            }, 415);
        }

        const form = await request.formData();

        const nama = String(form.get("nama") || "").trim();
        const kelas = String(form.get("kelas") || "").trim();
        const isi = String(form.get("isi") || "").trim();

        if (!nama || !kelas || !isi) {
            return jsonResponse({
                success: false,
                message: "Nama, kelas, dan isi aspirasi wajib diisi."
            }, 400);
        }

        if (nama.length > 100 || isi.length > 1000) {
            return jsonResponse({
                success: false,
                message: "Nama atau isi aspirasi melebihi batas."
            }, 400);
        }

        const allowedClasses = [
            "XA", "XB", "XIA", "XIB", "XIIA", "XIIB"
        ];

        if (!allowedClasses.includes(kelas)) {
            return jsonResponse({
                success: false,
                message: "Kelas tidak valid."
            }, 400);
        }

        const files = form.getAll("files").filter(
            item => item instanceof File && item.size > 0
        );

        if (files.length > MAX_FILES) {
            return jsonResponse({
                success: false,
                message: "Maksimal 3 file untuk setiap aspirasi."
            }, 400);
        }

        let totalSize = 0;

        for (const file of files) {
            if (!ALLOWED_TYPES[file.type]) {
                return jsonResponse({
                    success: false,
                    message: `Format file ${file.name} tidak didukung.`
                }, 400);
            }

            if (file.size > MAX_FILE_SIZE) {
                return jsonResponse({
                    success: false,
                    message: `File ${file.name} melebihi batas 4 MB.`
                }, 400);
            }

            totalSize += file.size;
        }

        if (totalSize > MAX_TOTAL_SIZE) {
            return jsonResponse({
                success: false,
                message: "Total ukuran lampiran maksimal 5 MB."
            }, 400);
        }

        const token = process.env.TOKEN_BOT_ID;

        const chatIds = [
            process.env.CHAT_ID_1,
            process.env.CHAT_ID_2
        ].filter(Boolean);

        if (!token || chatIds.length === 0) {
            console.error("Environment Variable belum lengkap.");

            return jsonResponse({
                success: false,
                message: "Konfigurasi server belum lengkap."
            }, 500);
        }

        const now = new Date();

        const tanggal = now.toLocaleDateString("id-ID", {
            timeZone: "Asia/Jakarta",
            day: "2-digit",
            month: "long",
            year: "numeric"
        });

        const waktu = now.toLocaleTimeString("id-ID", {
            timeZone: "Asia/Jakarta",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        });

        const message =
`📩 <b>ASPIRASI SMAN 3 TEBAS</b>

🗓 ${escapeHTML(tanggal)} • ⏰ ${escapeHTML(waktu)}

👤 ${escapeHTML(nama)}
🎓 ${escapeHTML(kelas)}

💬
${escapeHTML(isi)}

📎 Lampiran: ${files.length} file

🚀 via Smanti Web System`;

        const telegram = async (method, body) => {
            const response = await fetch(
                `https://api.telegram.org/bot${token}/${method}`,
                {
                    method: "POST",
                    body
                }
            );

            const result = await response.json();

            if (!response.ok || !result.ok) {
                throw new Error(
                    `Telegram ${method} gagal: ${result.description || response.status}`
                );
            }

            return result;
        };

        const sendToChat = async chatId => {
            // Kirim pesan utama terlebih dahulu.
            await telegram(
                "sendMessage",
                new URLSearchParams({
                    chat_id: chatId,
                    text: message,
                    parse_mode: "HTML"
                })
            );

            // Kirim lampiran satu per satu.
            for (const file of files) {
                const type = ALLOWED_TYPES[file.type];

                const data = new FormData();
                data.append("chat_id", chatId);
                data.append(
                    type === "photo" ? "photo" : "video",
                    file,
                    file.name
                );

                data.append(
                    "caption",
                    `📎 Lampiran aspirasi ${nama} (${kelas})`
                );

                await telegram(
                    type === "photo" ? "sendPhoto" : "sendVideo",
                    data
                );
            }

            return true;
        };

        // Kirim secara berurutan ke masing-masing chat.
        const results = await Promise.allSettled(
            chatIds.map(chatId => sendToChat(chatId))
        );

        const failed = results.filter(
            result => result.status === "rejected"
        );

        if (failed.length > 0) {
            console.error(
                "Sebagian pengiriman Telegram gagal:",
                failed.map(result => result.reason?.message)
            );

            return jsonResponse({
                success: false,
                message: "Sebagian pengiriman gagal. Hubungi administrator jika diperlukan."
            }, 502);
        }

        return jsonResponse({
            success: true,
            message: "Aspirasi dan lampiran berhasil dikirim."
        });

    } catch (error) {
        console.error("Aspirasi error:", error);

        return jsonResponse({
            success: false,
            message: "Terjadi kesalahan pada server."
        }, 500);
    }
};