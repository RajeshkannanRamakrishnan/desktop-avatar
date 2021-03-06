'use strict'
const req = require('@tpp/req')

const PORT = 7749

/*    way/
 * get a set of messages from the log file pass to the processor and ask
 * the scheduler how/when to continue. Returns a control structure that
 * can be used to stop getting more data (aside from using the scheduler)
 */
function get(log, processor, scheduler, from) {
  let ctrl = { stop:false }
  from = from || 1
  let p = `http://localhost:${PORT}/get/${log}?from=`
  get_1()
  return ctrl

  function get_1() {
    if(ctrl.stop) return

    let u = p + from
    req.get(u, (err, resp) => {
      if(ctrl.stop) return

      let last = resp.headers()["x-kafjs-lastmsgsent"]
      if(last) {
        last = parseInt(last)
        if(!isNaN(last)) from = last + 1
      }
      if(err) return schedule_1(err)
      if(resp) {
        if(!Array.isArray(resp.body)) {
          return schedule_1({ err: "bad response", resp })
        } else {
          resp = resp.body
        }
      }
      let end = (resp && resp.length) ? false : true
      if(!end) processor(resp, from)
      return schedule_1(null, end, from)
    })
  }

  function schedule_1(err, end, from) {
    let tm = scheduler(err, end, from)
    if(tm) setTimeout(get_1, tm)
  }

}

/*    understand/
 * put the logs in the order they come in, retrying on failure
 */
let PENDING = []
let sending
function sendPending() {
  if(sending || !PENDING.length) return
  sending = true

  let m = PENDING[0]

  let url = `http://localhost:${PORT}/put/${m.log}`
  req.send({
    method: "POST",
    url,
    data:m.msg,
    headers: { "Content-Type": "application/json" },
  }, (err, resp) => {
    sending = false
    if(err) {
      console.error(err)
      setTimeout(sendPending, 2 * 1000)
    } else {
      PENDING.shift()
      m.cb && m.cb()
      sendPending()
    }
  })

}

/*    way/
 * add the message to the put queue and kick off the sending process
 */
function put(msg, log, cb) {
  msg = JSON.stringify(msg)
  PENDING.push({ log, msg, cb })
  sendPending()
}


module.exports = {
  PORT,
  put,
  get,
}

