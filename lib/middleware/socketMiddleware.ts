import * as cookie from "cookie";
import requestIp from "request-ip";
import { UAParser } from "ua-parser-js"
import { Socket } from "socket.io";

const socketMiddleware = (socket: Socket, next: () => void) => {
    const reqCookieHeader = socket.request.headers.cookie;
    const userAgent = UAParser(socket.request.headers['user-agent']);
    const ipAddressRow = requestIp.getClientIp(socket.request) || '';
    const ipAddress = ipAddressRow === '::1' ? '127.0.0.1' : ipAddressRow.replace(/^::ffff:/, '');
    const { browser, os, device } = userAgent;
    const deviceName = [browser.name, browser.version, os.name, os.version, device.vendor, device.model].join(' ');
    socket.data.deviceName = deviceName;
    socket.data.userAgent = userAgent;
    socket.data.ipAddress = ipAddress;
    socket.data.deviceInfo = { ipAddress, deviceName };
    if (reqCookieHeader) {
        const cookies = cookie.parseCookie(reqCookieHeader);
        socket.data.cookies = cookies;
    } else {
        socket.data.cookies = {};
    }
    next();
};

export default socketMiddleware;