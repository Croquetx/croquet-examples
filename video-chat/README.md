# Croquet Video Chat

This would be a good place to describe how it's supposed to work.

In the mean time ...

# Debugging

This gives all logs sorted by time:

    CROQUETVM.modelsByName.modelRoot.peerLogs.sort((a,b)=>a.timestamp - b.timestamp).map(ea => ({date: new Date(ea.timestamp), ...ea}))

and this decodes one `handle` from these entries:

    Croquet.Data.fetch(CROQUETVM.id, handle).then(buf => console.log(new TextDecoder().decode(buf)))

and this should do it for all logs

    Promise.all(CROQUETVM.modelsByName.modelRoot.peerLogs.sort((a,b)=>a.timestamp - b.timestamp).map(async ea => ({date: new Date(ea.timestamp), log: await Croquet.Data.fetch(CROQUETVM.id, ea.handle).then(buf => new TextDecoder().decode(buf)), ...ea}))).then(console.log),"this might take a while"
