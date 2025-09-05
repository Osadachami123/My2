export default async function ping({ sock, from }) {
    const t0 = Date.now()
    const m = await sock.sendMessage(from, { text: 'Pinging…' })
    const dt = Date.now() - t0
    await sock.sendMessage(from, { text: `Pong ${dt}ms` }, { quoted: m })
}
