
interface iTo {
    recv: string;
    amt: string;
}
export type tercJsonType = {
    p?: string;
    op?: 'deploy' | 'mint' | 'transfer';
    tick?: string;
    afrom?: string;
    amt?: string;
    max?: string;
    lim?: string;
    wlim?: string;
    dec?: string;
    nonce?: string;
    blockNumber?: string;
    to?: iTo[];
}

const transferCheck = async (
    ts: {
        nonce: string;
        from: string;
    }, 
    tick: string,
    to?: iTo[], 
    nonce?: string,
    amt?: string,
): Promise<boolean> => {    
    const transferLists = await new Promise((ok) => {
        db.all(`SELECT * FROM T_ERC WHERE op = ? AND tick = ? AND afrom = ?`, ["transfer", tick, ts.from.toLocaleLowerCase()], (err, row: any) => {
            !err ? ok(row) : console.log('SELECT error InsertTerc transfer', err) 
        })
    }) as tercJsonType[]
    
    let nonces: string[] = []
    for (const mintInfo of transferLists) {
        nonces.push(mintInfo.nonce)
    }
    if(
        to 
        && to.length 
        && !nonces.includes(nonce)
    ){
        const total_amt = to.map(e => e.amt).reduce((a, b) => {
            return new BigNumber(a).plus(b).toFixed(0)
        })
        if(
            new BigNumber(total_amt).isEqualTo(new BigNumber(amt))
        ){
            return true
        }else{
            return false
        }
    }
    return false
}


export const InsertTerc = (ts: scanRowType, json: tercJsonType) => {
    return new Promise(async (_ok) => {
        let to_str = ''
        if(json.tick){
            if(json.op === 'deploy'){
                if(json.max && parseInt(json.max) >= parseInt(json.lim)){
                    let insertSql = `INSERT OR IGNORE INTO T_IERC20_tick (tick, amount, holder, max, creator, time, json) VALUES (?, ?, ?, ?, ?, ?, ?)`;
                    db.run(insertSql, [json.tick, 0, 0, json.max, ts.from.toLocaleLowerCase(), ts.timeStamp, JSON.stringify(json)]);
                }else{
                    console.log('deploy error')
                }
            }
            if(json.op === 'mint') {
                await mintHandle(ts, json)
            }
            if(json.op === 'transfer'){
                const isCheckTransfer = await transferCheck(ts, json.tick, json.to, json.nonce, json.amt)
                if(isCheckTransfer){
                    to_str = JSON.stringify(json.to)
                }
                await transferHandle(ts, json)
            }
        }
        db.run(
          `INSERT INTO T_ERC (
            p, op, tick, afrom, 
            amt, max, lim, wlim, 
            dec, nonce,
            ato, blockNumber,
            hash
            )
            VALUES ( 
              ?, ?, ?, ?, 
              ?, ?, ?, ?, 
              ?, ?,
              ?, ?,
              ?
            )`,
          [
            json.p,
            json.op,
            json.tick,
            ts.from.toLocaleLowerCase(),
            json.amt,
            json.max,
            json.lim,
            json.wlim,
            json.dec,
            json.nonce,
            to_str || '',
            ts.blockNumber,
            ts.hash,
          ],
          (err, row) => {
            if(err){
                console.log('INSERT INTO IERC20 err, row', err, row)
                return
            }
            _ok('')
          }
        );
    })
}
