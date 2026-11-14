export async function openBrowserPage(debug = 'http://127.0.0.1:9222') {
  const target = await (await fetch(`${debug}/json/new?about:blank`, { method: 'PUT' })).json()
  const socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })
  let id = 0
  const pending = new Map()
  const exceptions = []
  const responses = []
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data)
    if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails)
    if (message.method === 'Network.responseReceived') responses.push({ url: message.params.response.url,
      type: message.params.type, fromServiceWorker: message.params.response.fromServiceWorker === true })
    if (!message.id) return
    const call = pending.get(message.id)
    pending.delete(message.id)
    if (message.error) call.reject(new Error(JSON.stringify(message.error)))
    else call.resolve(message.result)
  })
  const command = (method, params = {}) => new Promise((resolve, reject) => {
    pending.set(++id, { resolve, reject })
    socket.send(JSON.stringify({ id, method, params }))
  })
  const evaluate = async expression => {
    const result = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true })
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails))
    return result.result.value
  }
  const wait = async expression => {
    const until = Date.now() + 20_000
    while (Date.now() < until) {
      if (await evaluate(`(async()=>Boolean(await (${expression})))()`)) return
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    throw new Error(`Timed out: ${expression}`)
  }
  await command('Page.enable')
  await command('Page.bringToFront')
  await command('Runtime.enable')
  return { command, evaluate, wait, exceptions, responses,
    close: async () => { await fetch(`${debug}/json/close/${target.id}`); socket.close() },
  }
}
