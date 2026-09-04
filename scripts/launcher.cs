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

        byte[] data = File.ReadAllBytes(self);
        int zipStart = FindZipStart(data);
        if (zipStart < 0)
        {
            Console.Error.WriteLine("torlink: no embedded payload found in executable.");
            Environment.Exit(1);
        }

        Directory.CreateDirectory(tmp);
        try
        {
            using (MemoryStream ms = new MemoryStream(data, zipStart, data.Length - zipStart))
            using (ZipArchive zip = new ZipArchive(ms, ZipArchiveMode.Read))
            {
                foreach (ZipArchiveEntry entry in zip.Entries)
                {
                    string target = Path.Combine(tmp, entry.FullName);
                    if (entry.FullName.EndsWith("/") || entry.FullName.EndsWith("\\"))
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
        }
        finally
        {
            Array.Clear(data, 0, data.Length);
        }

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

        // Try to release the temp folder; okay if it fails (a file may be
        // locked briefly by an antivirus scanner).
        try
        {
            Directory.Delete(tmp, true);
        }
        catch (Exception) { }

        Environment.ExitCode = proc.ExitCode;
    }

    // Locate the start of the appended ZIP archive by walking the End of
    // Central Directory record, which sits at the very end of the file.
    static int FindZipStart(byte[] data)
    {
        // EOCD signature: PK\x05\x06, followed by 16 bytes, then central dir
        // size (4) and central dir offset (4). Search the last 64KB.
        int searchFrom = Math.Max(0, data.Length - 65536);
        int eocd = -1;
        for (int i = data.Length - 22; i >= searchFrom; i--)
        {
            if (data[i] == 0x50 && data[i + 1] == 0x4B &&
                data[i + 2] == 0x05 && data[i + 3] == 0x06)
            {
                eocd = i;
                break;
            }
        }
        if (eocd < 0) return -1;

        // EOCD layout (offset relative to eocd):
        //   0: signature (4)
        //   4: disk number (2)
        //   6: disk with central dir (2)
        //   8: entries on this disk (2)
        //   10: total entries (2)
        //   12: central dir size (4)
        //   16: central dir offset (4)
        int centralDirOffset = BitConverter.ToInt32(data, eocd + 16);
        if (centralDirOffset < 0 || centralDirOffset >= data.Length) return -1;
        return centralDirOffset;
    }
}
