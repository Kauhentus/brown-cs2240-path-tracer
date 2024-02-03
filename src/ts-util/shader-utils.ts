export const loadShaders = (shaderPaths: string[]) => {
    return Promise.all(shaderPaths.map(path => {
        return new Promise<string>((resolve) => {
            const client = new XMLHttpRequest();
            client.open('GET', path);
            client.onload = function() {
                const shaderCode = client.responseText;
                resolve(shaderCode);
            }
            client.send();
        });
    }));
}

export const preprocessShaders = async (rawShaderCode: string[], paths: string[]) => {
    let mainProgram = rawShaderCode[0];
    let mainRoot = paths[0].split('/').slice(0, -1).join('/') + '/';
    let imported: string[] = [];

    const processFile = (rawCode: string, rel_path: string) => {
        let programLines: string[] = rawCode.split('\n').map(line => {
            if(line.includes('#include')){
                const filename = `${rel_path}${line.slice(9).trim()}`;
                const fileIndex = paths.indexOf(filename);

                if(fileIndex === -1) console.error(`#include ${filename} was not found at path`);
                if(imported.indexOf(filename) !== -1) return '';

                const new_rel_path = filename.split('/').slice(0, -1).join('/') + '/';
                imported.push(filename);
                return processFile(rawShaderCode[fileIndex], new_rel_path);
            } else {
                return line;
            }
        });

        return programLines.join('\n');
    }

    const result = processFile(mainProgram, mainRoot);
    return [result];
}

