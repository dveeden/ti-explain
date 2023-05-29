function clearExplain() {
    document.getElementById("simpletable").innerHTML = '';
    document.getElementById("content").innerHTML = '';
    document.getElementById("tree").innerHTML = '<pre id="treepre"></pre>';
    document.getElementById("explaintext").value = '';
}

function loadExample() {
    fetch("testdata/explain_0004.txt")
        .then(r => {
            r.text()
                .then(r => {
                    document.getElementById("explaintext").value = r
                })
        })
}

function lineToArray(line, columnstarts) {
    let cols = [];
    for (let i = 0; i < columnstarts.length - 1; i++) {
        let colStart = columnstarts[i] + 2;
        let colEnd = columnstarts[i + 1] - 1;
        cols.push(line.substring(colStart, colEnd));
    }
    return cols;
}

function lineToObj(line, explaininfo) {
    let colData = {};
    let cols = lineToArray(line, explaininfo["columnstarts"]);
    for (let i = 0; i < cols.length; i++) {
        colData[explaininfo["columnnames"][i]] = cols[i];
    }
    return colData;
}

function formatInfo(info) {
    return info.replace(/: ?\{/g, ":{\n")
        .replace(/, /g, ",\n")
        .trim();
}

function formatStruct(info) {
    let i = 0;
    let r = "";

    for (let c of info) {
        if (![" ", "}", ")"].includes(c)) {
            r += c;
        }

        if (["{", "("].includes(c)) {
            i++;
            r += "\n" + " ".repeat(i * 2);
        } else if (["}", ")"].includes(c)) {
            i--;
            r += "\n" + " ".repeat(i * 2) + c;
        } else if (c == ",") {
            r += "\n" + " ".repeat(i * 2);
        } else if (c == ":") {
            r += " ";
        }
    }

    return r;
}

function explainExplain(explaininfo) {
    let outputDiv = document.getElementById("content");
    let treeDiv = document.getElementById("tree");
    treeDiv.innerHTML = '<pre id="treepre"></pre>';
    let treePre = document.getElementById("treepre");
    let simpleTbl = document.getElementById("simpletable");
    outputDiv.innerHTML = '';
    treeDiv.insertBefore(document.createTextNode("Explain Tree"), treePre);

    let str = document.createElement("tr");
    explaininfo["columnnames"].forEach(col => {
        let td = document.createElement("td");
        td.appendChild(document.createTextNode(col));
        str.appendChild(td);
    });
    simpleTbl.appendChild(str);

    explaininfo["rows"].forEach((row) => {
        treePre.appendChild(document.createTextNode(row["id"] + "\n"));
        outputDiv.appendChild(document.createElement("hr"));
        outputDiv.appendChild(document.createTextNode("Going to try and explain this row:"));
        let t = document.createElement("table");
        t.className = "explainrow";
        let rt = document.createElement("tr");
        let rd = document.createElement("tr");
        for (let [col, val] of Object.entries(row)) {
            let c = document.createElement("td");
            c.appendChild(document.createTextNode(col));
            rt.appendChild(c);

            c = document.createElement("td");
            let pre = document.createElement("pre");
            if (["execution info", "operator info"].includes(col)) {
                pre.appendChild(document.createTextNode(formatStruct(val)));
            } else if (col == "id") {
                pre.appendChild(document.createTextNode(val))
            } else {
                pre.appendChild(document.createTextNode(formatInfo(val)));
            }
            c.appendChild(pre);
            rd.appendChild(c);
        }
        t.appendChild(rt);
        simpleTbl.appendChild(rd.cloneNode(true))
        rd.firstChild.firstChild.textContent = rd.firstChild.firstChild.textContent.trim()
        t.appendChild(rd);
        outputDiv.appendChild(t);

        if (row["task"].trim() == "cop[tikv]") {
            outputDiv.appendChild(document.createTextNode("Using coprocessor for TiKV row based storage."));
            outputDiv.appendChild(document.createElement("br"));
            let link = document.createElement("a");
            link.appendChild(document.createTextNode("For more info: TiDB Docs: TiKV Coprocessor"));
            link.href = "https://docs.pingcap.com/tidb/stable/tikv-overview#tikv-coprocessor";
            outputDiv.appendChild(link);
            outputDiv.appendChild(document.createElement("br"));
        }

        if (row["task"].trim() == "cop[tiflash]") {
            outputDiv.appendChild(document.createTextNode("Using distributed coprocessor for TiFlash column based storage."));
            outputDiv.appendChild(document.createElement("br"));
            let link = document.createElement("a");
            link.appendChild(document.createTextNode("For more info: TiFlash Overview"));
            link.href = "https://docs.pingcap.com/tidb/stable/tiflash-overview";
            outputDiv.appendChild(link);
            outputDiv.appendChild(document.createElement("br"));
        }

        if (row["task"].trim() == "mpp[tiflash]") {
            outputDiv.appendChild(document.createTextNode("Using distributed MPP for TiFlash column based storage."));
            outputDiv.appendChild(document.createElement("br"));
            let link = document.createElement("a");
            link.appendChild(document.createTextNode("For more info: TiFlash Overview"));
            link.href = "https://docs.pingcap.com/tidb/stable/tiflash-overview";
            outputDiv.appendChild(link);
            outputDiv.appendChild(document.createElement("br"));

            link = document.createElement("a");
            link.appendChild(document.createTextNode("For more info: TiFlash MPP mode"));
            link.href = "https://docs.pingcap.com/tidb/stable/use-tiflash#use-the-mpp-mode";
            outputDiv.appendChild(link);
            outputDiv.appendChild(document.createElement("br"));
        }

        if (row["operator info"].match(/stats:pseudo/)) {
            outputDiv.appendChild(document.createTextNode("Using pseudo statistics, consider running ANALYZE TABLE."));
            outputDiv.appendChild(document.createElement("br"));
        }

        // https://docs.pingcap.com/tidb/dev/explain-overview#operator-overview
        // https://docs.pingcap.com/tidb/dev/choose-index#operators-for-accessing-tables
        let operator = row["id"].match(/([A-Z].*)_/)[1];
        let operatorAdv;
        let operatorURL;
        switch (operator) {
            case "TableDual":
                operatorAdv = "Virtual single row table.";
                break;
            case "TableFullScan":
                operatorAdv = "Full table scan, consider adding an index.";
                break;
            case "TableRangeScan":
                operatorAdv = "Scans a range of the table.";
                break;
            case "TableReader":
                operatorAdv = "Aggregates the data obtained by the underlying operators like TableFullScan or TableRangeScan in TiKV.";
                break;
            case "TableRowIDScan":
                operatorAdv = "Scans the table data based on the RowID. Usually follows an index read operation to retrieve the matching data rows.";
                break;
            case "IndexFullScan":
                operatorAdv = "Scans the full index, rather than the table data.";
                break;
            case "IndexRangeScan":
                operatorAdv = "Scans a range of the index.";
                break;
            case "HashJoin":
                operatorURL = "https://docs.pingcap.com/tidb/dev/explain-joins#hash-join";
                break;
            case "ExchangeSender":
                operatorURL = "https://docs.pingcap.com/tidb/dev/explain-mpp#exchange-operators";
                break;
            case "HashAgg":
                operatorURL = "https://docs.pingcap.com/tidb/dev/explain-aggregation#hash-aggregation";
                break;
            case "Projection":
                operatorAdv = "Maps expression value(s) to select list.";
                break;
            case "StreamAgg":
                operatorURL = "https://docs.pingcap.com/tidb/dev/explain-aggregation#stream-aggregation";
                break;
            default:
                console.log("No advise available for '" + operator + "' operator");
        }

        if (operatorAdv) {
            outputDiv.appendChild(document.createTextNode("Info for the \"" + operator + "\" operator: " + operatorAdv));
            outputDiv.appendChild(document.createElement("br"));
        }

        if (operatorURL) {
            let link = document.createElement("a");
            link.appendChild(document.createTextNode("More info on the " + operator + " operator can be found here."));
            link.href = operatorURL;
            outputDiv.appendChild(link);
        }


    });
}

function checkExplain() {
    let explaininfo = {
        "columnstarts": [],
        "columnnames": [],
        "rows": [],
    };
    let hasColumnInfo = false;
    let hasColumnNames = false;
    let rowNumber = 0;
    let expText = document.getElementById("explaintext").value;
    let expLines = expText.split(/\r?\n/);

    if (expLines[0].match("\t?id *\ttask")) {
        expLines.forEach((expLine) => {
            if (!hasColumnInfo) { // header
                hasColumnInfo = true;
                explaininfo.columnnames = expLine.split("\t").map(x => x.trim());
                explaininfo.columnnames.shift()
            } else {
                coldata = expLine.split("\t")
                coldata.shift()
                explaininfo.rows[rowNumber] = {}
                for (const [index, element] of coldata.entries()) {
                    explaininfo.rows[rowNumber][explaininfo.columnnames[index]] = element;
                }
                rowNumber++;
            }
        });
    } else { // MySQL Client Output
        expLines.forEach((expLine) => {
            if ((expLine[0] == "+") && !hasColumnInfo) {
                hasColumnInfo = true;
                for (let i = 0; i < expLine.length; i++) {
                    if (expLine[i] == "+") {
                        explaininfo["columnstarts"].push(i);
                    }
                }
            } else if ((expLine[0] == "|") && hasColumnInfo) {
                if (!hasColumnNames) {
                    hasColumnNames = true;
                    explaininfo["columnnames"] = lineToArray(expLine, explaininfo["columnstarts"]).map(
                        x => x.trim()
                    );
                } else {
                    explaininfo["rows"][rowNumber] = lineToObj(expLine, explaininfo);
                    rowNumber++;
                }
            }
        });
    }
    console.log(explaininfo);
    explainExplain(explaininfo);
}