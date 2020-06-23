self.importScripts('./spark-md5.min.js')

self.onmessage = (e) => {
  // 接受
  const { chunks } = e.data
  const spark = new self.SparkMD5.ArrayBuffer()

  let progress = 0
  let count = 0

  const loadNext = (index) => {
    const reader = new FileReader()
    reader.readAsArrayBuffer(chunks[index].file)
    reader.onload = (e) => {
      count++
      spark.append(e.target.result)

      if (count === chunks.length) {
        self.postMessage({
          progress: 100,
          hash: spark.end()
        })
      } else {
        progress += Number((100 / chunks.length).toFixed(2))
        // 取两位小数，四舍五入溢出100
        if (progress > 100) {
          progress = 100
        }
        self.postMessage({
          progress
        })
        loadNext(index + 1)
      }
    }
  }
  loadNext(0)
}
