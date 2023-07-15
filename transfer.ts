export const transferHandle = (ts: scanRowType, json: tercJsonType) => {
    return new Promise(async (ok) => {
        try {
            const transferFromBalance = await getTercBalance(ts.from.toLocaleLowerCase(), json.tick)
            const transerAmt = json.to.map(e => e?.recv?.toLocaleLowerCase() === ts.from.toLocaleLowerCase() ? 0 : parseFloat(e.amt)).reduce((a, b) => a + b)
            // balance check
            if(
                transferFromBalance && 
                new BigNumber(transferFromBalance).isGreaterThanOrEqualTo(new BigNumber(transerAmt).multipliedBy(1e8))
            ){
                const totalChange = new BigNumber(transerAmt).multipliedBy(1e8).toFixed(0)
                const fromAddress = ts.from.toLocaleLowerCase()
                let sql = `UPDATE balances SET balance = balance - ? WHERE address = ? AND tick = ?`;
                db.run(sql, [totalChange, fromAddress, json.tick]);

                for (const transferItem of json.to) {
                    const update = {
                        balanceChange: new BigNumber(transferItem.amt).multipliedBy(1e8).toFixed(0),
                        address: transferItem.recv.toLocaleLowerCase(),
                    }
                    // send to recv
                    if(
                        transferItem?.recv 
                        && transferItem.recv[0] === '0' 
                        && transferItem.recv[1] === 'x'
                        // to address not self
                        && transferItem.recv.toLocaleLowerCase() !== ts.from.toLocaleLowerCase()
                        && transferItem.amt
                        && parseFloat(transferItem.amt) > 0
                    ){
                        await new Promise((ok) => {
                            db.serialize(() => {
                                let insertSql = `INSERT OR IGNORE INTO balances (address, tick, balance) VALUES (?, ?, 0)`;
                                db.run(insertSql, [update.address, json.tick]);
                                
                                db.run(insertBalanceChangeSql, [
                                    ts.from.toLocaleLowerCase(),
                                    ts.from.toLocaleLowerCase(),
                                    transferItem.recv.toLocaleLowerCase(),
                                    ts.timeStamp,
                                    json.tick,
                                    ts.hash,
                                    ts.blockNumber,
                                    json.nonce,
                                    1,
                                    transferItem.amt,
                                ])

                                let updateSql = `UPDATE balances SET balance = balance + ? WHERE address = ? AND tick = ?`;
                                db.run(updateSql, [update.balanceChange, update.address, json.tick], (err, row) => {
                                    !err ? ok(row) : console.log('SELECT error InsertTerc update balance', err) 
                                });
                            })
                        })
                    }
                }
            }else{
                db.run(insertBalanceChangeSql, [
                    ts.from.toLocaleLowerCase(),
                    ts.from.toLocaleLowerCase(),
                    json?.to?.map((e) => e?.recv?.toLocaleLowerCase()).join(',') ?? '',
                    ts.timeStamp,
                    json.tick,
                    ts.hash,
                    ts.blockNumber,
                    json.nonce,
                    0,
                    transerAmt,
                ])
            }
        } catch (error) {
            
        }
        ok('')
    })
}
