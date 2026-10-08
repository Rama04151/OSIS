export default async (request) => {

if (request.method !== "POST") {

    return new Response(
        JSON.stringify({
            success: false,
            message: "Method tidak diizinkan."
        }),
        {
            status: 405,
            headers: {
                "Content-Type": "application/json"
            }
        }
    );

}


try {

    const body = await request.json();

    const nama = String(body.nama || "").trim();
    const kelas = String(body.kelas || "").trim();
    const isi = String(body.isi || "").trim();


    if (!nama || !kelas || !isi) {

        return new Response(
            JSON.stringify({
                success: false,
                message: "Data tidak lengkap."
            }),
            {
                status: 400,
                headers: {
                    "Content-Type": "application/json"
                }
            }
        );

    }


    const token =
        process.env.TOKEN_BOT_ID;

    const chatIds = [
        process.env.CHAT_ID_1,
        process.env.CHAT_ID_2
    ].filter(Boolean);


    if (!token || chatIds.length === 0) {

        console.error(
            "Environment Variable belum lengkap."
        );

        return new Response(
            JSON.stringify({
                success: false,
                message: "Konfigurasi server belum lengkap."
            }),
            {
                status:500,
                headers:{
                    "Content-Type":"application/json"
                }
            }
        );

    }


    const now = new Date();

    const tanggal =
        now.toLocaleDateString(
            "id-ID",
            {
                timeZone:"Asia/Jakarta"
            }
        );

    const waktu =
        now.toLocaleTimeString(
            "id-ID",
            {
                timeZone:"Asia/Jakarta"
            }
        );


    const message =

`📩 ASPIRASI SMAN 3 TEBAS

🗓 ${tanggal} • ⏰ ${waktu}

👤 ${nama}
🎓 ${kelas}

💬
“${isi}”

🚀 via Smanti Web System`;

    const results = await Promise.all(

        chatIds.map(async (chatId) => {

            const response =
                await fetch(
                    `https://api.telegram.org/bot${token}/sendMessage`,
                    {
                        method:"POST",

                        headers:{
                            "Content-Type":
                                "application/json"
                        },

                        body:JSON.stringify({
                            chat_id:chatId,
                            text:message
                        })
                    }
                );


            const result =
                await response.json();


            return {
                chatId,
                ok:response.ok,
                result
            };

        })

    );


    const failed =
        results.filter(item => !item.ok);


    if (failed.length > 0) {

        console.error(
            "Telegram error:",
            failed
        );

        return new Response(
            JSON.stringify({
                success:false,
                message:"Sebagian pesan gagal dikirim."
            }),
            {
                status:502,
                headers:{
                    "Content-Type":
                        "application/json"
                }
            }
        );

    }


    return new Response(
        JSON.stringify({
            success:true,
            message:"Aspirasi berhasil dikirim."
        }),
        {
            status:200,
            headers:{
                "Content-Type":
                    "application/json"
            }
        }
    );


} catch(error) {

    console.error(error);

    return new Response(
        JSON.stringify({
            success:false,
            message:"Terjadi kesalahan pada server."
        }),
        {
            status:500,
            headers:{
                "Content-Type":
                    "application/json"
            }
        }
    );

}

};
