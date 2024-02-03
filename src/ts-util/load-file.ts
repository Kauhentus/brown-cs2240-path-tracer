export const load_file = (path: string) => {
    return new Promise<string>((resolve, reject) => {
        const client = new XMLHttpRequest();
        client.open('GET', path);
        client.onload = function() {
            const file_content = client.responseText;
            if(client.status === 404){
                reject("file error");
            } else {
                resolve(file_content);
            }
        }
        client.send();
    });
}