const mongoose = require('mongoose')
const path = require('path')
const Telegraf = require('telegraf')
const TelegrafMixpanel = require('telegraf-mixpanel')
const I18n = require('telegraf-i18n')
const session = require('telegraf/session')
const onlyAdmin = require('./middlewares/only-admin')
const User = require('./models/user')
const Group = require('./models/group')
const { handleHelp, handleBanan, handleKick, handleDelete, handleGif } = require('./handlers')
const { userLogin } = require('./lib')

mongoose.connect('mongodb://localhost:27017/LyAdminBot', {
  useCreateIndex: true,
  useNewUrlParser: true
})

const db = mongoose.connection
db.on('error', err => {
  console.log('error', err)
})

const i18n = new I18n({
  directory: path.resolve(__dirname, 'locales'),
  defaultLanguage: 'ru',
  sessionName: 'session',
  useSession: true
})

const bot = new Telegraf(process.env.BOT_TOKEN)
const mixpanel = new TelegrafMixpanel(process.env.MIXPANEL_TOKEN)

const gifs = ['CgADAgADqAEAAmJG2Uglzd9EwW55bwI', 'CgADBAADyx4AAhQYZAetvXlEFn5cswI', 'CgADBAAD2p8AAnsaZAcJm0k7V_kXNAI', 'CgADAgADNQADS_BhSDpVCwqAH-ApAg', 'CgADAgADHwEAAvB2IUlCVQ-SgmWrHgI', 'CgADAgADowADW7g4StIu7SVZ0yipAg', 'CgADBAAD6XQAAhIZZAeTavEu0igaiAI', 'CgADAgADvQAD4AUwSQS5MUl_EGsyAg', 'CgADAgAD4AEAAlvyUgd71fE8N2Hk_QI', 'CgADBAADqaEAAlcZZAfGeJGIyZqlewI', 'CgADBAAD5IkBAAEVGGQH0W-_EJ5srcIC', 'CgADAgADLAADqsgYSR_BdlF8KTJMAg', 'CgADBAADa6AAAtIcZActYXkQawyAOgI', 'CgADBAADHdcAAswdZAcu3MWguaCW-AI', 'CgADBAADpRYAAswdZAcpeGLhy5LTGQI', 'CgADBAADxhoAAsUaZAfJ7wp8FdS2xQI', 'CgADAgAD7gEAAkil-UjXyAw0cwaZWgI', 'CgADBAADAgEAAh-cYVNbj7BOYD9JtgI']

const captions = [
  'Hi, %login%',
  'Привіт, %login%✌️ Ми чекали лише тебе😘',
  'О, %login%. Ты где пропадал? Тебя только ждали.',
  '%login%, добро пожаловать в нашу компанию 🤜🏻🤛🏿',
  '%login%, приветствуем в нашем царстве👑',
  'Добрий день, %login%, не журися, козаче, тепер ти з нами😱',
  '%login%, яке щастя, що ти тепер з нами!',
  'Hisashiburi desu, %login% ✌',
  'Yahhoo %login% 🙋🏻',
  '%login%, устраивайся поудобнее😉',
  'Вы посмотрите😲 Это же %login%!',
  '%login%, ну и что ты тут забыл?😒',
  '%login%, за вход передаем!',
  'Кто разрешил сюда зайти %login% ?🤔',
  '%login% няша😘',
  'Поприветствуйте %login% 🙋🏼‍♂️',
  '%login%, а кто это такой к нам пришел? 😲',
  '%login%, мяу😽',
  '👏🏻 AYAYA %login% 😝'
]

bot.telegram.getMe().then((botInfo) => {
  bot.options.username = botInfo.username
})

bot.use(mixpanel.middleware())
bot.use(session())
bot.use(i18n.middleware())

bot.use(async (ctx, next) => {
  const start = new Date()
  User.findOneAndUpdate({
    telegram_id: ctx.from.id
  }, {
    first_name: ctx.from.first_name,
    last_name: ctx.from.last_name,
    username: ctx.from.username,
    last_act: ctx.message.date
  }, { new: true, setDefaultsOnInsert: true, upsert: true }, function (err, doc) {
    if (err) return console.log(err)
  })
  ctx.mixpanel.people.set()
  ctx.mixpanel.people.setOnce({
    $created: new Date().toISOString()
  })

  if (ctx.chat.id > 0) {

  } else {
    await Group.findOneAndUpdate({
      group_id: ctx.chat.id
    }, {
      title: ctx.chat.title
    }, { new: true, upsert: true }, function (err, doc) {
      if (err) return console.log(err)
      if (!doc.settings.gifs || !doc.settings.captions) {
        doc.settings = {
          welcome: true,
          gifs: gifs,
          captions: captions
        }
        doc.save()
      }
      ctx.groupInfo = doc
    })
  }
  await next(ctx)
  const ms = new Date() - start
  console.log('Response time %sms', ms)
})

bot.command('help', handleHelp)

bot.command('type', (ctx) => {
  return ctx.replyWithHTML(`<b>Chat type:</b> <pre>${ctx.chat.type}</pre>`)
})

bot.command('nbanan', handleBanan)
bot.command('nkick', handleKick)
bot.command('del', handleDelete)
bot.command('gif', onlyAdmin, handleGif)

bot.command('welcome_reset', (ctx) => {
  Group.update(
    { group_id: ctx.chat.id },
    { 'settings.gifs': gifs, 'settings.captions': captions }, (err, doc) => {
      if (err) return console.log(err)
      ctx.replyWithHTML(
        ctx.i18n.t('welcome.reset')
      )
    }
  )
})

bot.command('test', (ctx) => {
  return ctx.replyWithHTML(ctx.i18n.t('cmd.test', { userLogin: userLogin(ctx.from, true) }))
})

bot.on('new_chat_members', async (ctx) => {
  ctx.mixpanel.track('new member')
  var gifs = ctx.groupInfo.settings.gifs
  var randomGif = gifs[Math.floor(Math.random() * gifs.length)]
  var captions = ctx.groupInfo.settings.captions
  var randomCaption = captions[Math.floor(Math.random() * captions.length)]
  const message = await ctx.replyWithDocument(
    randomGif,
    { 'caption': randomCaption.replace('%login%', userLogin(ctx.from)) }
  )
  setTimeout(() => {
    ctx.deleteMessage(message.message_id)
  }, 60000)
})

bot.on('message', (ctx) => {
  if (ctx.chat.id > 0) {
    ctx.replyWithHTML(
      ctx.i18n.t('private.start', {
        login: userLogin(ctx.from)
      })
    )
    ctx.mixpanel.track('private message')
  } else {
    ctx.mixpanel.track('group message', { group: ctx.chat.id })
  }
})

bot.catch((err) => {
  console.log('Ooops', err)
})

bot.startPolling()
