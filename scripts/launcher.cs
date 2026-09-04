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
        string zipFile = Path.Combine(Path.GetTempPath(), "torlink-payload-" + stamp + ".zip");

        // --- Extract the embedded ZIP from the end of this exe ---
        long zipFrom, zipLen;
        if (!FindZipBounds(self, out zipFrom, out zipLen))
        {
            Console.Error.WriteLine("torlink: no embedded payload found in executable.");
            Environment.Exit(1);
        }

        ExtractZipPortion(self, zipFrom, zipLen, zipFile);

        // --- Extract the ZIP contents to temp dir using ZipArchive ---
        try
        {
            Directory.CreateDirectory(tmp);
            using (FileStream zipStream = File.OpenRead(zipFile))
            using (ZipArchive archive = new ZipArchive(zipStream, ZipArchiveMode.Read))
            {
                foreach (ZipArchiveEntry entry in archive.Entries)
                {
                    string target = Path.Combine(tmp, entry.FullName);
                    if (entry.FullName.EndsWith("/") || entry.FullName.EndsWith("\\"))
                    {
                        Directory.CreateDirectory(target);
                        continue;
                    }
                    string dir = Path.GetDirectoryName(target);
                    if (!string.IsNullOrEmpty(dir)) Directory.CreateDirectory(dir);

                    using (Stream src = entry.Open())
                    using (FileStream dst = File.Create(target))
                    {
                        src.CopyTo(dst);
                    }
                }
            }
        }
        finally
        {
            try { File.Delete(zipFile); } catch (Exception) { }
        }

        // --- Verify extracted files ---
        string node = Path.Combine(tmp, "bundled-node.exe");
        string app = Path.Combine(tmp, "dist", "cli.cjs");
        if (!File.Exists(node) || !File.Exists(app))
        {
            Console.Error.WriteLine("torlink: bundled runtime missing after extraction.");
            Environment.Exit(1);
        }

        // --- Launch bundled Node.js ---
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

        // Clean up temp folder (best-effort)
        try { Directory.Delete(tmp, true); } catch (Exception) { }

        Environment.ExitCode = proc.ExitCode;
    }

    // --- Write just the ZIP bytes from the exe to a temp file ---
    static void ExtractZipPortion(string exePath, long zipFrom, long zipLen, string dest)
    {
        using (FileStream src = File.OpenRead(exePath))
        {
            src.Seek(zipFrom, SeekOrigin.Begin);
            using (FileStream dst = File.Create(dest))
            {
                long remaining = zipLen;
                byte[] buf = new byte[1 << 20]; // 1 MB buffer
                while (remaining > 0)
                {
                    int toRead = (int)Math.Min(buf.Length, remaining);
                    int read = src.Read(buf, 0, toRead);
                    if (read <= 0) break;
                    dst.Write(buf, 0, read);
                    remaining -= read;
                }
            }
        }
    }

    // --- Locate the embedded ZIP archive ---
    //
    // Layout of the final exe:
    //   [C# launcher PE][ZIP archive]
    //
    // The ZIP's End of Central Directory (EOCD, PK\x05\x06) is the last
    // record in the archive.  It contains:
    //   offset 12: central directory size (uint32)
    //   offset 16: central directory offset, relative to ZIP start (uint32)
    //
    // So: ZIP start = EOCD_position - centralDirOffset - centralDirSize
    static bool FindZipBounds(string exePath, out long zipFrom, out long zipLen)
    {
        zipFrom = 0;
        zipLen = 0;

        long len = new FileInfo(exePath).Length;
        int tailLen = (int)Math.Min(len, 65536 + 22);
        byte[] tail = new byte[tailLen];

        using (FileStream fs = File.OpenRead(exePath))
        {
            fs.Seek(len - tailLen, SeekOrigin.Begin);
            int read = 0;
            while (read < tailLen)
            {
                int n = fs.Read(tail, read, tailLen - read);
                if (n <= 0) break;
                read += n;
            }
        }

        int eocd = -1;
        for (int i = tailLen - 22; i >= 0; i--)
        {
            if (tail[i] == 0x50 && tail[i + 1] == 0x4B &&
                tail[i + 2] == 0x05 && tail[i + 3] == 0x06)
            {
                eocd = i;
                break;
            }
        }
        if (eocd < 0) return false;

        long eocdPos = len - tailLen + eocd;

        long cdSize = ReadUInt32(tail, eocd + 12);
        long cdOffset = ReadUInt32(tail, eocd + 16);

        long start = eocdPos - cdOffset - cdSize;
        if (start < 0 || start >= len) return false;

        zipFrom = start;
        zipLen = len - start;
        return true;
    }

    static long ReadUInt32(byte[] b, int off)
    {
        return (long)((uint)b[off] |
                      (uint)b[off + 1] << 8 |
                      (uint)b[off + 2] << 16 |
                      (uint)b[off + 3] << 24);
    }
}
