import makeWASocket, { useSingleFileAuthState, DisconnectReason } from '@whiskeysockets/baileys'
import fs from 'fs'
import path from 'path'
import pino from 'pino'
import { PREFIX, OWNERS, SESSION_FILE, PAIR_CODE } from './config.js'

async function loadPlugins() {
    const pluginsDir = path.join(process.cwd(), 'plugins')
    if (!fs.existsSync(pluginsDir)) return {}
    const files = fs.readdirSync(pluginsDir).filter(f => f.endsWith('.js'))
    const plugs = {}
    for (const f of files) {
        const mod = await import(`file://${path.join(pluginsDir, f)}?update=${Date.now()}`)
        plugs[path.basename(f, '.js')] = mod.default
    }
    return plugs
}

async function start() {
    const { state, saveCreds } = useSingleFileAuthState(SESSION_FILE)
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
        if (connection === 'close') {
            const code = lastDisconnect?.error?.output?.statusCode
            if (code !== DisconnectReason.loggedOut) {
                start()
            } else {
                console.log('Logged out. Delete session file and rescan pair code.')
            }
        } else if (connection === 'open') {
            console.log('✅ Connected via pair code:', PAIR_CODE)
        }
    })

    const plugins = await loadPlugins()

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0]
        if (!msg?.message || msg.key.fromMe) return
        const from = msg.key.remoteJid
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text
        if (!text) return

        if (text.startsWith(PREFIX)) {
            const [cmd, ...args] = text.slice(PREFIX.length).trim().split(/\s+/)
            const plug = plugins[cmd]
            if (plug) {
                try {
                    await plug({ sock, from, msg, args, text, PREFIX, OWNERS })
                } catch (e) {
                    console.error(e)
                    await sock.sendMessage(from, { text: '⚠️ Error in plugin.' })
                }
            }
        }
    })
}

start()
