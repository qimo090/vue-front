<template>
  <div class="user-container">
    <h3>用户中心</h3>
    <!-- 拖拽 -->
    <div id="drag" ref="drag">
      <label class="fileInput">
        <span class="uploadText">{{
          file ? file.name : "点击或拖拽上传"
        }}</span>
        <input type="file" name="file" @change="handleFileChange">
      </label>
    </div>
    <!-- 计算hash进度条 -->
    <div>
      <h3>计算hash的进度</h3>
      <!-- <span>Hash - Web Worker</span>
      <el-progress :text-inside="true" :stroke-width="20" :percentage="hashWorkerProgress" />
      <span>Hash - Idle</span>
      <el-progress :text-inside="true" :stroke-width="20" :percentage="hashIdleProgress" />
      <span>Hash - Sample</span> -->
      <el-progress
        status="success"
        :text-inside="true"
        :stroke-width="20"
        :percentage="hashSampleProgress"
      />
    </div>
    <div>
      <el-button round type="primary" style="width: 100%;" @click="uploadFile">
        上传
      </el-button>
    </div>
    <!-- 上传进度条 -->
    <div class="uploadProgress">
      <h3>文件上传的进度</h3>
      <el-progress
        :text-inside="true"
        :stroke-width="20"
        :percentage="uploadProgress || uploadedProgress"
      />
    </div>
    <div>
      <!-- 尽可能让方块看起来是正方形 -->
      <div class="cube-container">
        <div v-for="chunk in chunks" :key="chunk.name" class="cube">
          <div
            :class="{
              uploading: chunk.progress > 0 && chunk.progress < 100,
              success: chunk.progress === 100,
              error: chunk.progress < 0
            }"
            :style="{
              height: chunk.progress + '%'
            }"
          >
            <!-- <i v-if="chunk.progress < 100 && chunk.progress > 0" class="el-icon-loading" style="color: '#f56c6c" /> -->
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import SparkMD5 from 'spark-md5'

const CHUNK_SIZE = 0.5 * 1024 * 1024
export default {
  name: 'Uc',
  data () {
    return {
      file: null,
      uploadedProgress: 0,
      hashWorkerProgress: 0,
      hashIdleProgress: 0,
      hashSampleProgress: 0,
      chunks: []
    }
  },
  computed: {
    cubeWidth () {
      return Math.ceil(Math.sqrt(this.chunks.length) + 2) * 20
    },
    // 上传进度
    uploadProgress () {
      if (!this.file || this.chunks.length === 0) {
        return 0
      }
      const loaded = this.chunks
        .map(item => (item.chunk.size * item.progress) / 100)
        .reduce((acc, cur) => acc + cur, 0)
      return Number(((loaded * 100) / this.file.size).toFixed(2))
    }
  },
  async mounted () {
    await this.$http.get('/user/info')
    this.bindEvents()
  },
  methods: {
    // 绑定事件
    bindEvents () {
      const drag = this.$refs.drag
      drag.addEventListener('dragover', (e) => {
        e.preventDefault()
        drag.style.borderColor = 'red'
      })
      drag.addEventListener('dragleave', (e) => {
        e.preventDefault()
        drag.style.borderColor = '#eee'
      })
      drag.addEventListener('drop', (e) => {
        e.preventDefault()
        const fileList = e.dataTransfer.files
        drag.style.borderColor = '#eee'
        this.file = fileList[0]
      })
    },
    blobToString (blob) {
      return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = function () {
          const ret = reader.result
            .split('')
            .map(v => v.charCodeAt())
            .map(v => v.toString(16).toUpperCase())
            .join(' ')
          resolve(ret)
        }
        reader.readAsBinaryString(blob)
      })
    },
    // 是否是gif
    async isGif (file) {
      // 前六位 '47 49 46 38 39 61' (GIF89a) || '47 49 46 38 37 61' (GIF87a)
      // 十六进制的转换
      const ret = await this.blobToString(file.slice(0, 6))
      return ret === '47 49 46 38 39 61' || ret === '47 49 46 38 37 61'
    },
    // 图片是否是png '89 50 4E 47'
    async isPng (file) {
      const ret = await this.blobToString(file.slice(0, 8))
      return ret === '89 50 4E 47 0D 0A 1A'
    },
    // 图片是否是jpg 'FF D8' + 'FF D9'
    async isJpg (file) {
      const ret1 = await this.blobToString(file.slice(0, 2))
      const ret2 = await this.blobToString(file.slice(-2))
      return `${ret1} ${ret2}` === 'FF D8 FF D9'
    },
    // 是否是图片
    isImage (file) {
      // 通过二进制文件流来判定
      // 先判断是不是gif
      return this.isGif(file)
    },
    // 文件切片
    createFileChunk (file, size = CHUNK_SIZE) {
      const chunks = []
      let cur = 0
      while (cur < file.size) {
        chunks.push({
          index: cur,
          file: this.file.slice(cur, cur + size)
        })
        cur += size
      }
      return chunks
    },
    // web-worker 计算md5
    calculateHashWorker (chunks) {
      return new Promise((resolve) => {
        this.worker = new Worker('/hash.js')
        this.worker.postMessage({ chunks })
        this.worker.onmessage = (e) => {
          const { progress, hash } = e.data
          this.hashWorkerProgress = Number(progress.toFixed(2))
          if (hash) {
            resolve(hash)
          }
        }
      })
    },
    // idle 计算md5
    calculateHashIdle (chunks) {
      return new Promise((resolve) => {
        const spark = new SparkMD5.ArrayBuffer()
        let count = 0
        // 利用空闲时间计算
        const appendToSpark = (file) => {
          return new Promise((resolve) => {
            const reader = new FileReader()
            reader.readAsArrayBuffer(file)
            reader.onload = (e) => {
              spark.append(e.target.result)
              resolve()
            }
          })
        }
        const workLoop = async (deadline) => {
          while (count < chunks.length && deadline.timeRemaining() > 1) {
            // 空闲时间，且有任务
            await appendToSpark(chunks[count].file)
            count++
            if (count < chunks.length) {
              this.hashIdleProgress = Number(
                ((100 * count) / chunks.length).toFixed(2)
              )
              if (this.hashIdleProgress > 100) {
                this.hashIdleProgress = 100
              }
            } else {
              this.hashIdleProgress = 100
              resolve(spark.end())
            }
          }
          window.requestIdleCallback(workLoop)
        }
        window.requestIdleCallback(workLoop)
      })
    },
    // 抽样hash
    calculateHashSample (file) {
      return new Promise((resolve) => {
        const spark = new SparkMD5.ArrayBuffer()
        const reader = new FileReader()

        const size = file.size
        const offset = 2 * 1024 * 1024
        // 第一个2M，最后一个区块数据全要
        const chunks = [file.slice(0, offset)]

        let cur = offset
        while (cur < size) {
          if (cur + offset >= size) {
            // 最后一个区块
            chunks.push(file.slice(cur, cur + offset))
          } else {
            // 中间区块
            const mid = cur + offset / 2
            const end = cur + offset
            chunks.push(file.slice(cur, cur + 2))
            chunks.push(file.slice(mid, mid + 2))
            chunks.push(file.slice(end, end - 2))
          }
          cur += offset
        }
        // 中间，去前中后各2字节
        reader.readAsArrayBuffer(new Blob(chunks))
        reader.onload = (e) => {
          spark.append(e.target.result)
          this.hashSampleProgress = 100
          resolve(spark.end())
        }
      })
    },
    // 文件上传 请求
    // async uploadFile () {
    //   this.chunks = this.createFileChunk(this.file)
    //   // const hashWorker = await this.calculateHashWorker(this.chunks)
    //   // console.log('uploadFile -> hashWorker', hashWorker)
    //   // const hashIdle = await this.calculateHashIdle(this.chunks)
    //   // console.log('uploadFile -> hashIdle  ', hashIdle)
    //   // 抽样hash 不算全量
    //   const hashSample = await this.calculateHashSample(this.file)
    //   console.log('uploadFile -> hashSample', hashSample)
    // },
    async uploadFile () {
      if (!this.file) {
        this.$alert('请先上传一个文件')
        return
      }
      // if (!await this.isImage(this.file)) {
      //   this.$alert('文件格式不对')
      //   return
      // }
      const chunks = this.createFileChunk(this.file)
      const hash = await this.calculateHashSample(this.file)
      this.hash = hash
      // 寻问后端，文件是否上传过，如果没有，是否有存在的切片
      const { data: { uploaded, uploadedList } } = await this.$http.post('/checkfile', {
        hash: this.hash,
        ext: this.file.name.split('.').pop()
      })
      // 存在该文件，直接终止
      if (uploaded) {
        this.chunks = []
        this.uploadedProgress = 100
        this.$message.success('秒传成功')
        return false
      }
      this.uploadedProgress = 0
      this.chunks = chunks.map((chunk, index) => {
        // name = hash + index
        const name = hash + '-' + index
        return {
          hash,
          name,
          index,
          chunk: chunk.file,
          progress: uploadedList.includes(name) ? 100 : 0
        }
      })

      await this.uploadChunks(uploadedList)
    },
    //
    async uploadChunks (uploadedList) {
      const requests = this.chunks
        .filter(chunk => !uploadedList.includes(chunk.name))
        .map((chunk) => {
          // 转成 Promise
          const formData = new FormData()
          formData.append('chunk', chunk.chunk)
          formData.append('hash', chunk.hash)
          formData.append('name', chunk.name)
          formData.append('index', chunk.index)
          return { formData, index: chunk.index, error: 0 }
        })

      await this.sendRequest(requests)
      // 合并文件
      await this.mergeRequest()
    },
    /**
     * 控制请求并发
     * @param {Array} requests 所有chunks参数组成的数组
     * @param {Number} limit 限制并发请求次数
     */
    sendRequest (requests, limit = 3) {
      return new Promise((resolve, reject) => {
        const len = requests.length // 总请求次数 === 总chunks数量
        let counter = 0 // 请求次数累计
        let isStop = false // 控制终止上传过程
        const start = async () => {
          if (isStop) { return }
          const task = requests.shift()
          if (task) {
            const { formData, index } = task
            try {
              await this.$http.post('/uploadfile', formData, {
                onUploadProgress: (progress) => {
                  // 不是整体的进度条，是每个区块的进度条
                  this.chunks[index].progress = Number(
                    ((progress.loaded / progress.total) * 100).toFixed(2)
                  )
                }
              })
              if (counter === len - 1) {
                // 最后一个任务
                resolve()
              } else {
                counter++
                start()
              }
            } catch (e) {
              // 文件上传出错，进度格子变红
              this.chunks[index].progress = -1
              // 当一个切片上传错误重试次数达到3次，终止上传
              if (task.error >= 3) {
                isStop = true
                reject()
              } else {
                // 否则将当前任务推回请求首位 进行重试 并且错误次数递增
                task.error++
                requests.unshift(task)
                start()
              }
            }
          }
        }
        while (limit > 0) {
          // 启动limit个任务
          // !直接同时启动limit个任务，其实就是同时只开辟四个通道，当某个通道完成一个请求时再在该通道发起下一个请求
          setTimeout(() => {
            start()
          }, Math.random() * 2000)
          limit -= 1
        }
        // ---------------------------------------
        // const start = () => {
        //   // 有请求，有通道
        //   while (idx < len && limit > 0) {
        //     limit-- // 占用通道
        //     // console.log(idx, 'start')
        //     const formData = requests[idx]
        //     const index = requests[idx].get('index')
        //     idx++
        //     this.$http.post('/uploadfile', formData, {
        //       onUploadProgress: (progress) => {
        //         // 不是整体的进度条，是每个区块的进度条
        //         this.chunks[index].progress = Number(
        //           ((progress.loaded / progress.total) * 100).toFixed(2)
        //         )
        //       }
        //     }).then(() => {
        //       limit++ // 释放通道
        //       counter++
        //       if (counter === len) {
        //         resolve()
        //       } else {
        //         start()
        //       }
        //     })
        //   }
        // }
        // start()
      })
    },
    // 合并文件请求
    async mergeRequest () {
      await this.$http.post('/mergefile', {
        ext: this.file.name.split('.').pop(), // 后缀名
        size: CHUNK_SIZE,
        hash: this.hash
      })
    },
    // 上传文件选择
    handleFileChange (e) {
      this.file = null
      this.chunks = []
      this.hashSampleProgress = 0
      this.uploadedProgress = 0
      const [file] = e.target.files
      if (!file) {
        return false
      }
      this.file = file
    }
  }
}
</script>

<style lang="less" scoped>
.user-container {
  & > div,
  h3 {
    margin: 20px auto;
    width: 360px;
    text-align: center;
  }
}
#drag {
  height: 100px;
  width: 360px;
  border: 2px dashed #eee;
  text-align: center;
  &:hover {
    border-color: red;
  }
}

.uploadProgress {
  width: 360px;
}
.fileInput {
  display: block;
  line-height: 100px;
  width: 100%;
  height: 100%;
  cursor: grab;
  input[type='file'] {
    display: none;
  }
  .uploadText {
    display: inline-block;
    width: 250px;
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
  }
}

.cube-container {
  width: 100%;
  display: flex;
  flex-wrap: wrap;
  .cube {
    width: 20px;
    height: 20px;
    margin: 2px;
    line-height: 20px;
    border: 1px solid black;
    border-radius: 2px;
    background-color: #eee;
    .success {
      background-color: #0f0;
    }
    .uploading {
      background-color: rgb(61, 61, 94);
    }
    .error {
      background-color: red;
    }
  }
}
</style>
