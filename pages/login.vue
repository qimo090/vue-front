<template>
  <div class="login-container">
    <el-form ref="loginForm" :model="form" :rules="rules" class="login-form" label-width="100px">
      <!-- logo -->
      <div class="title-container">
        <img alt="logo" src="/logo.svg">
      </div>
      <!-- 邮箱 -->
      <el-form-item label="邮箱" prop="email">
        <el-input v-model="form.email" placeholder="请输入邮箱" />
      </el-form-item>
      <!-- 密码 -->
      <el-form-item label="密码" prop="password">
        <el-input v-model="form.password" placeholder="请输入密码" show-password type="password" />
      </el-form-item>
      <!-- 验证码 -->
      <el-form-item label="验证码" prop="captcha">
        <el-input v-model="form.captcha" placeholder="验证码">
          <img slot="suffix" :src="code.captcha" alt="captcha" @click="updateCaptcha">
        </el-input>
      </el-form-item>
      <!-- 邮箱验证码 -->
      <el-form-item label="邮箱验证码" prop="emailcode">
        <el-input v-model="form.emailcode" placeholder="邮箱验证码">
          <el-button slot="append" class="slotAppend" type="primary" :disabled="send.timer > 0" @click="sendEmailCode">
            {{ sendText }}
          </el-button>
        </el-input>
      </el-form-item>
      <!-- 提交按钮 -->
      <el-form-item>
        <el-button type="primary" @click.native.prevent="handleLogin">
          登录
        </el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script>
import md5 from 'md5'

export default {
  name: 'Login',
  data () {
    return {
      send: {
        timer: 0
      },
      form: {
        email: '1061572496@qq.com',
        captcha: '',
        password: 'a123456',
        emailcode: ''
      },
      rules: {
        email: [
          { required: true, message: '请输入邮箱' },
          { type: 'email', message: '邮箱格式不正确' }
        ],
        captcha: [{ required: true, message: '请输入图片验证码' }],
        emailcode: [{ required: true, message: '请输入邮箱验证码' }],
        password: [{ required: true, pattern: /^[\w_-]{6,12}$/g, message: '请输入6~12位密码' }]
      },
      code: {
        captcha: '/api/captcha'
      }
    }
  },
  computed: {
    sendText () {
      return this.send.timer <= 0 ? '发送验证码' : `${this.send.timer}后发送`
    }
  },
  mounted () {
    // 获取图片验证码
    this.updateCaptcha()
  },
  methods: {
    // 发送邮箱验证码
    async sendEmailCode () {
      await this.$http.get(`/sendcode?email=${this.form.email}`)
      this.send.timer = 10
      this.timer = setInterval(() => {
        this.send.timer -= 1
        if (this.send.timer <= 0) {
          clearInterval(this.timer)
        }
      }, 1000)
    },
    // 更新图片验证码
    updateCaptcha () {
      this.code.captcha = `/api/captcha?_t=${new Date().getTime()}`
    },
    // 表单提交
    handleLogin () {
      this.$refs.loginForm.validate(async (valid) => {
        if (valid) {
          // console.log('校验成功')
          const { email, captcha, password, emailcode } = this.form
          const obj = {
            email,
            captcha,
            emailcode,
            password: md5(password)
          }

          const ret = await this.$http.post('/user/login', obj)
          // code = 0 === success
          if (ret.code === 0) {
            // token的存储，登录成功，返回token
            this.$message.success('登录成功')
            localStorage.setItem('token', ret.data.token)
            setTimeout(() => {
              this.$router.push('/')
            }, 500)
          } else {
            this.$message.error(ret.message)
          }
        } else {
          // console.log('校验失败')
        }
      })
    }
  }
}
</script>

<style lang="less" scoped>
.sendCodeBtn {
  width: 120px;
}
</style>
