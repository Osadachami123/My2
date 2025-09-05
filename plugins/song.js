import yts from 'yt-search'
import ytdl from 'ytdl-core'
import fs from 'fs'

export default async function song({ sock, from, args }) {
    if (!args[0]) return sock.sendMessage(from, { text: '❌ Please give me a song name!' })

    const query = args.join(' ')
    const r = await yts(query)
    const vid = r.videos[0]
    if (!vid) return sock.sendMessage(from, { text: '❌ Song not found.' })

    const title = vid.title.replace(/[^\w\s]/gi, '')
    const file = `./${title}.mp3`

    try {
        await new Promise((resolve, reject) => {
            ytdl(vid.url, { filter: 'audioonly', quality: 'highestaudio' })
                .pipe(fs.createWriteStream(file))
                .on('finish', resolve)
                .on('error', reject)
        })

        await sock.sendMessage(from, {
            audio: { url: file },
            mimetype: 'audio/mpeg',
            fileName: `${title}.mp3`
        })

        fs.unlinkSync(file)
    } catch (e) {
        console.error(e)
        await sock.sendMessage(from, { text: '⚠️ Error downloading song.' })
    }
}
