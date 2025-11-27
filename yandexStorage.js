// yandexStorage.js
import { S3Client, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import fs from 'fs'

const BUCKET = process.env.YC_BUCKET || 'progid-images'

if (!process.env.YC_ACCESS_KEY_ID || !process.env.YC_SECRET_ACCESS_KEY) {
  console.warn(
    '[yandexStorage] ВНИМАНИЕ: не заданы YC_ACCESS_KEY_ID / YC_SECRET_ACCESS_KEY'
  )
}

export const s3 = new S3Client({
  region: 'ru-central1',
  endpoint: 'https://storage.yandexcloud.net',
  credentials: {
    accessKeyId: process.env.YC_ACCESS_KEY_ID,
    secretAccessKey: process.env.YC_SECRET_ACCESS_KEY,
  },
})

export function makePublicUrl(key) {
  return `https://storage.yandexcloud.net/${BUCKET}/${key}`
}

export async function uploadFile(localPath, key) {
  // читаем файл в буфер (НЕ Promise)
  const fileData = await fs.promises.readFile(localPath)

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: fileData,
    ACL: 'public-read',
    ContentType: 'image/jpeg',
  })

  await s3.send(command)

  return makePublicUrl(key)
}

export async function listPhotosByPrefix(prefix) {
  const cmd = new ListObjectsV2Command({
    Bucket: BUCKET,
    Prefix: prefix,
  })

  const resp = await s3.send(cmd)
  const contents = resp.Contents || []

  return contents
    .filter((obj) => !!obj.Key)
    .map((obj) => makePublicUrl(obj.Key))
}

// helper чтобы немного нормализовать имя города в пути
export function cityToSlug(city = '') {
  return city
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'unknown'
}

export { BUCKET }
