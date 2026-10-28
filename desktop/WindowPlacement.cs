using System.Text.Json;

namespace OhMyLLMs;

internal sealed record WindowPlacement(int X, int Y, int Width, int Height, int Dpi, bool Maximized)
{
    public static void Restore(Form window, string path)
    {
        var area = Screen.FromHandle(window.Handle).WorkingArea;
        var scale = window.DeviceDpi / 96d;
        var margin = (int)(24 * scale);
        window.MinimumSize = new Size(Math.Min((int)(900 * scale), area.Width - margin),
            Math.Min((int)(640 * scale), area.Height - margin));
        var frame = window.Size - window.ClientSize;
        var fit = Math.Min(1, Math.Min((area.Width - margin * 2 - frame.Width) / (1480 * scale),
            (area.Height - margin * 2 - frame.Height) / (1000 * scale)));
        var preferred = new Size((int)(1480 * scale * fit) + frame.Width, (int)(1000 * scale * fit) + frame.Height);
        var bounds = new Rectangle(area.X + margin, area.Y + margin,
            Math.Min(preferred.Width, area.Width - margin * 2),
            Math.Min(preferred.Height, area.Height - margin * 2));
        var maximized = false;
        try
        {
            if (File.Exists(path) && JsonSerializer.Deserialize<WindowPlacement>(File.ReadAllText(path)) is { } saved
                && saved.Width > 0 && saved.Height > 0 && saved.Dpi > 0)
            {
                area = Screen.FromRectangle(new Rectangle(saved.X, saved.Y, saved.Width, saved.Height)).WorkingArea;
                var ratio = (double)window.DeviceDpi / saved.Dpi;
                bounds = new Rectangle(saved.X, saved.Y, (int)(saved.Width * ratio), (int)(saved.Height * ratio));
                maximized = saved.Maximized;
            }
            else
            {
                bounds.X = area.X + (area.Width - bounds.Width) / 2;
                bounds.Y = area.Y + (area.Height - bounds.Height) / 2;
            }
        }
        catch (Exception error) when (error is IOException or JsonException or UnauthorizedAccessException) { }
        window.MinimumSize = new Size(Math.Min((int)(900 * scale), area.Width - margin),
            Math.Min((int)(640 * scale), area.Height - margin));
        bounds.Width = Math.Clamp(bounds.Width, Math.Min(window.MinimumSize.Width, area.Width), area.Width);
        bounds.Height = Math.Clamp(bounds.Height, Math.Min(window.MinimumSize.Height, area.Height), area.Height);
        bounds.X = Math.Clamp(bounds.X, area.Left, area.Right - bounds.Width);
        bounds.Y = Math.Clamp(bounds.Y, area.Top, area.Bottom - bounds.Height);
        window.Bounds = bounds;
        if (maximized) window.WindowState = FormWindowState.Maximized;
    }

    public static void Save(Form window, string path)
    {
        var rect = window.WindowState == FormWindowState.Normal ? window.Bounds : window.RestoreBounds;
        var saved = new WindowPlacement(rect.X, rect.Y, rect.Width, rect.Height,
            window.DeviceDpi, window.WindowState == FormWindowState.Maximized);
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            File.WriteAllText(path, JsonSerializer.Serialize(saved));
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException) { }
    }
}
