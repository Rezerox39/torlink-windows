using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Reflection;

class Launcher
{
    static void Main(string[] args)
    {
        string self = Assembly.GetExecutingAssembly().Location;
        string stamp = DateTime.Now.ToString("yyyyMMddHHmmss") + "_" + Guid.NewGuid().ToString("N").Substring(0, 8);
        string tmp = Path.Combine(Path.GetTempPath(), "torlink", stamp);

        ExtractSelf(self, tmp);

        string node = Path.Combine(tmp, "bundled-node.exe");
        string app = Path.Combine(tmp, "dist", "cli.cjs");
        if (!File.Exists(node) || !File.Exists(app))
        {
            Console.Error.WriteLine("torlink: bundled runtime missing after extraction.");
            Environment.Exit(1);
        }

        string allArgs = "\"" + app + "\"";
        foreach (string a in args)
        {
            allArgs += " \"" + a.Replace("\"", "\\\"") + "\"";
        }

        ProcessStartInfo psi = new ProcessStartInfo();
        psi.FileName = node;
        psi.Arguments = allArgs;
        psi.UseShellExecute = false;
        psi.WorkingDirectory = tmp;
        psi.CreateNoWindow = false;

        Process proc = Process.Start(psi);
        proc.WaitForExit();

        try { Directory.Delete(tmp, true); } catch (Exception) { }
        Environment.ExitCode = proc.ExitCode;
    }

    static void ExtractSelf(string self, string dest)
    {
        byte[] data = File.ReadAllBytes(self);
        int start = -1;
        // Scan backwards for the ZIP local file header ("PK\x03\x04").
        // The ZIP payload is appended at the very end of this exe, so the
        // last occurrence is the start of the embedded archive.
        for (int i = data.Length - 4; i >= 0; i--)
        {
            if (data[i] == 0x50 && data[i + 1] == 0x4B &&
                data[i + 2] == 0x03 && data[i + 3] == 0x04)
            {
                start = i;
                break;
            }
        }
        if (start < 0)
        {
            Console.Error.WriteLine("torlink: no embedded payload found in executable.");
            Environment.Exit(1);
        }

        Directory.CreateDirectory(dest);
        using (MemoryStream ms = new MemoryStream(data, start, data.Length - start))
        using (ZipArchive zip = new ZipArchive(ms, ZipArchiveMode.Read))
        {
            foreach (ZipArchiveEntry entry in zip.Entries)
            {
                string target = Path.Combine(dest, entry.FullName);
                if (entry.FullName.EndsWith("/"))
                {
                    Directory.CreateDirectory(target);
                    continue;
                }
                Directory.CreateDirectory(Path.GetDirectoryName(target));
                using (Stream src = entry.Open())
                using (FileStream outFile = File.Create(target))
                {
                    src.CopyTo(outFile);
                }
            }
        }
        Array.Clear(data, 0, data.Length);
    }
}
