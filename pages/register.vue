<template>
  <div class="login-container">
    <el-form ref="registerForm" :model="form" :rules="rules" class="login-form" label-width="100px">
      <!-- logo -->
      <div class="title-container">
        <img alt="logo" src="/logo.svg">
      </div>
      <!-- 邮箱 -->
      <el-form-item label="邮箱" prop="email">
        <el-input v-model="form.email" placeholder="请输入邮箱" />
      </el-form-item>
      <!-- 验证码 -->
      <el-form-item label="验证码" prop="captcha">
        <el-input v-model="form.captcha" placeholder="验证码">
          <img slot="suffix" :src="code.captcha" alt="captcha" @click="updateCaptcha">
        </el-input>
      </el-form-item>
      <!-- 昵称 -->
      <el-form-item label="昵称" prop="nickname">
        <el-input v-model="form.nickname" placeholder="请输入昵称" />
      </el-form-item>
      <!-- 密码 -->
      <el-form-item label="密码" prop="password">
        <el-input v-model="form.password" placeholder="请输入密码" show-password type="password" />
      </el-form-item>
      <!-- 确认密码 -->
      <el-form-item label="确认密码" prop="repassword">
        <el-input v-model="form.repassword" placeholder="请确认密码" show-password type="password" />
      </el-form-item>
      <!-- 提交按钮 -->
      <el-form-item>
        <el-button type="primary" @click.native.prevent="handleRegister">
          注册
        </el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script>
import md5 from 'md5'

export default {
  name: 'Register',
  data () {
    return {
      form: {
        email: '1061572496@qq.com',
        captcha: '',
        nickname: '祁陌',
        password: 'a123456',
        repassword: 'a123456'
      },
      rules: {
        email: [
          { required: true, message: '请输入邮箱' },
          { type: 'email', message: '邮箱格式不正确' }
        ],
        captcha: [{ required: true, message: '请输入验证码' }],
        nickname: [{ required: true, message: '请输入昵称' }],
        password: [
          {
            required: true,
            pattern: /^[\w_-]{6,12}$/g,
            message: '请输入6~12位密码'
          }
        ],
        repassword: [
          { required: true, message: '请再次输入密码' },
          {
            validator: (rule, value, callback) => {
              if (value !== this.form.password) {
                callback(new Error('两次密码不一致'))
              } else {
                callback()
              }
            }
          }
        ]
      },
      code: {
        captcha: '/api/captcha'
      }
    }
  },
  mounted () {
    // 获取图片验证码
    this.updateCaptcha()
  },
  methods: {
    updateCaptcha () {
      this.code.captcha = `/api/captcha?_t=${new Date().getTime()}`
    },
    // 表单提交
    handleRegister () {
      this.$refs.registerForm.validate(async (valid) => {
        if (valid) {
          // console.log('校验成功')
          const { email, captcha, nickname, password } = this.form
          const obj = {
            email,
            captcha,
            nickname,
            password: md5(password)
          }

          const ret = await this.$http.post('/user/register', obj)
          // code = 0 === success
          if (ret.code === 0) {
            this.$alert('注册成功', '成功', {
              confirmButtonText: '去登录',
              callback: () => {
                this.$router.push('/login')
              }
            })
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
</style>
