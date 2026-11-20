import re,sys,os,subprocess,json
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/155.0.0.0 Safari/537.36"
page=subprocess.run(["curl","-sL","-m","40","-A",UA,sys.argv[1]],capture_output=True,text=True).stdout
imgs=sorted(set(re.findall(r'https://images\.szxuexiao\.com/[^"\']+\.jpg',page)))
out=sys.argv[2]; os.makedirs(out,exist_ok=True)
print(len(imgs), imgs[0] if imgs else '-', imgs[-1] if imgs else '-')
for u in imgs:
    subprocess.run(["curl","-s","-m","40","-A",UA,"-e","https://zxkeben.szxuexiao.com/",u,"-o",os.path.join(out,os.path.basename(u))])
